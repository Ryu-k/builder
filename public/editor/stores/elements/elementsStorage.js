import { addStorage, getStorage, getService, env } from 'vc-cake'
import { debounce } from 'lodash'
import { rebuildRawLayout } from './lib/tools'
import ModuleAPI from 'vc-cake/lib/module-api-constructor'
import innerAPI from 'public/components/api/innerAPI'

addStorage('elements', (storage) => {
  const documentManager = getService('document')
  const dataManager = getService('dataManager')
  const cook = getService('cook')
  const historyStorage = getStorage('history')
  const utils = getService('utils')
  const wordpressDataStorage = getStorage('wordpressData')
  const workspaceStorage = getStorage('workspace')
  const cacheStorage = getStorage('cache')
  const assetsStorage = getStorage('assets')
  const updateTimeMachine = () => {
    wordpressDataStorage.state('status').set({ status: 'changed' })
    historyStorage.trigger('add', documentManager.all())
  }
  let substituteIds = {}

  /**
   * Created to handle BC for the elements that doesn't have toggles anymore and use treeView visibility option instead
   Checks for 'toggle' value of elements and assign it to treeView children's 'hidden' option
   * @param cookElement
   * @param attrKey
   * @param innerElementValue
   */
  const getBcElement = (cookElement, attrKey, innerElementValue) => {
    let newInnerElementValue = innerElementValue
    innerElementValue.parent = cookElement.getAll().id
    const rules = cookElement.settings(attrKey)?.settings?.options?.onChange?.rules
    if (rules) {
      for (const [key, value] of Object.entries(rules)) {
        if (value?.rule === 'toggle') {
          newInnerElementValue = {
            ...innerElementValue,
            hidden: !cookElement.get(key)

          }
        }
        if (value?.rule === 'value') {
          newInnerElementValue = {
            ...innerElementValue,
            hidden: cookElement.get(key) !== attrKey
          }
        }
      }
    }
    return newInnerElementValue
  }
  /**
   * Required for elements with initChildren that are toggled via standalone attribute.
   * Checks the value of the togglable attribute and returns a boolean value
   * @param cookElement
   * @returns isVisible {boolean}
   */
  const getChildVisibility = (cookElement) => {
    const initChildren = cookElement.settings('initChildren')
    const isVisibilityDependency = initChildren.settings?.options && Object.prototype.hasOwnProperty.call(initChildren.settings?.options, 'visibilityDependency')
    if (!isVisibilityDependency) {
      return true
    }
    const dependencyProperty = isVisibilityDependency && initChildren.settings?.options?.visibilityDependency
    let isVisible = !!dependencyProperty

    if (dependencyProperty) {
      const dependencyAttributeRules = cookElement.settings(dependencyProperty).settings?.options?.onChange?.rules
      if (dependencyAttributeRules) {
        for (const ruleKey in dependencyAttributeRules) {
          const rule = dependencyAttributeRules[ruleKey].rule
          const ruleValue = cookElement.get(ruleKey)

          if ((rule === 'toggle' && !ruleValue) || (rule === '!toggle' && ruleValue)) {
            isVisible = false
          }
        }
      }
    }

    return isVisible
  }
  const addChildElement = (initChild, parentId, callback) => {
    initChild.parent = parentId
    const childData = cook.get(initChild)
    let childDataJS = { ...childData?.toJS(), isInitChild: true }
    if (initChild?.exclude) {
      childDataJS = {
        ...childDataJS,
        exclude: initChild?.exclude
      }
    }
    if (initChild?.hidden) {
      workspaceStorage.trigger('hide', childDataJS.id)
    }

    storage.trigger('add', childDataJS, true, { silent: true })
    storage.trigger('update', childDataJS.id, childDataJS)

    documentManager.create(childDataJS, {
      insertAfter: false
    })
    if (callback) {
      callback(childDataJS)
    }
  }
  const setInitChildren = (initChildren, parentId, deprecatedChildElement, callback) => {
    if (deprecatedChildElement) {
      addChildElement(deprecatedChildElement, parentId, callback)
    } else {
      initChildren.forEach((initChild) => {
        addChildElement(initChild, parentId, callback)
      })
    }
  }

  /**
   * Parse cookElement, update attribute values conditionally,
   * return cookElement.toJS()
   *
   * @param cookElement
   * @param callback
   * @returns {*}
   */
  const getElementToJS = (cookElement, callback) => {
    if (!cookElement) {
      return cookElement
    }
    const cookGetAll = cookElement.getAll()

    const elementAttributes = Object.keys(cookGetAll)
    elementAttributes.forEach((attrKey) => {
      const attributeSettings = cookElement.settings(attrKey)
      if (attributeSettings.settings.type === 'element') {
        const value = cookElement.get(attrKey)
        const innerElement = cook.get(value)
        const innerElementValue = getElementToJS(innerElement)
        cookElement.set(attrKey, innerElementValue)

        // checks if element has childElementBC attribute for Backwards Compatibility
        // required for child elements (after the migration from "element" to "treeView")
        // set childElementBC value to true, once new child elements are rendered
        // it will only run on page load, after save the new value will be applied
        if (elementAttributes.includes('childElementBC') && !cookElement.get('childElementBC') && callback) {
          const bcElement = getBcElement(cookElement, attrKey, innerElementValue)
          const initChildren = cookElement.get('initChildren')
          setInitChildren(initChildren, cookGetAll.id, bcElement, callback)
        }
      }
    })

    if (elementAttributes.includes('childElementBC') && !cookElement.get('childElementBC') && callback) {
      cookElement.set('childElementBC', true)
    }

    return cookElement.toJS()
  }
  const sanitizeData = (data, isLoadContent = false) => {
    let newData = Object.assign({}, data || {})
    const elementsKeys = Object.keys(data)
    elementsKeys.forEach((key) => {
      if (!Object.prototype.hasOwnProperty.call(newData, key)) {
        return
      }
      const cookElement = cook.get(newData[key])
      if (!cookElement) {
        delete newData[key]
        env('VCV_DEBUG') === true && console.warn(`Element with key ${key} removed, failed to get CookElement`)
      } else {
        const parent = cookElement.get('parent')
        if (parent) {
          if (!Object.prototype.hasOwnProperty.call(data, parent)) {
            delete newData[key]
            env('VCV_DEBUG') === true && console.warn(`Element with key ${key} removed, failed to get parent element`)
            newData = sanitizeData(newData, isLoadContent)
          } else {
            const childElements = []
            const getChildElements = (children) => {
              childElements.push(children)
            }
            const callback = isLoadContent && getChildElements
            newData[key] = getElementToJS(cookElement, callback)
            const isChildVisible = getChildVisibility(cookElement)

            // BC check if parent element has disabled children
            // Some element's components were updated,
            // in a way to render child elements conditionally
            // older elements may still have child elements rendered while they are disabled in the main element
            const parentCookElement = newData[parent] && cook.get(newData[parent])
            if (parentCookElement && !getChildVisibility(parentCookElement)) {
              delete newData[key]
            }

            if (isChildVisible && childElements && childElements.length) {
              childElements.forEach((element) => {
                if (!element.newElement) {
                  let elementID = element.id
                  let elementData = { ...element, ...{ newElement: true } }
                  // Condition for BC
                  // some child elements like Video Player play/pause buttons
                  // had duplicated ids when cloned (prior to version 45.2)
                  // we check if element id exists, and replace it with a new one.
                  if (!newData[elementID]) {
                    const cloneElementData = Object.assign({}, elementData)
                    delete cloneElementData.id
                    const newElementData = cook.get(cloneElementData).toJS()
                    elementData = { ...newElementData, ...{ newElement: true } }
                    elementID = elementData.id
                  }
                  newData[elementID] = elementData
                }
              })
            }
          }
        } else {
          newData[key] = getElementToJS(cookElement)
        }
      }
    })
    return newData
  }
  const setPopupRootElement = () => {
    const rootElements = documentManager.children(false)
    let rootId = null
    if (rootElements.length === 0) {
      const rootElement = cook.get({ tag: 'popupRoot' })
      rootId = rootElement.toJS().id
      if (rootElement) {
        storage.trigger('add', rootElement.toJS(), true, { silent: true })
      }
    } else {
      rootId = rootElements[0].id
    }
    return rootId
  }
  const appendChildren = (children, cookElement) => {
    children.forEach(child => {
      documentManager.appendTo(child.id, cookElement.get('id'))
    })
  }
  storage.state('document').onChange((layoutData) => {
    innerAPI.dispatch('layoutChange', layoutData)
  })
  const getParent = (elData) => {
    const parent = documentManager.get(elData.parent)
    if (parent.tag && parent.tag !== 'row') {
      return getParent(parent)
    } else {
      return parent
    }
  }
  storage.on('add', (elementData, wrap = true, options = {}) => {
    const cookElement = cook.get(elementData)
    if (!cookElement) {
      return
    }
    const breakBeforeAdd = storage.action('beforeAdd', elementData, wrap, options)
    if (breakBeforeAdd) {
      return
    }
    if (!utils.checkIfElementIsHidden(elementData)) {
      const elementAddList = storage.state('elementAddList').get() || []
      elementAddList.push(elementData.id)
      storage.state('elementAddList').set(elementAddList)
    }
    const cookGetAll = cookElement.getAll()
    const elementAttributes = Object.keys(cookGetAll)
    if (elementAttributes.includes('childElementBC') && !cookElement.get('childElementBC')) {
      cookElement.set('childElementBC', true)
    }
    elementData = getElementToJS(cookElement)
    const editorType = dataManager.get('editorType')
    if (wrap && !cookElement.get('parent')) {
      const parentWrapper = cookElement.get('parentWrapper')
      const wrapperTag = parentWrapper === undefined ? 'column' : parentWrapper
      if (wrapperTag) {
        const wrapperData = cook.get({ tag: wrapperTag })
        elementData.parent = wrapperData.toJS().id
        if (wrapperData && options?.action !== 'merge') {
          storage.trigger('add', wrapperData.toJS(), true, { skipInitialExtraElements: true, silent: true })
        }
      } else if (editorType === 'popup') {
        if (cookElement.get('tag') !== 'popupRoot') {
          elementData.parent = setPopupRootElement()
        } else {
          const allElements = documentManager.children(false)
          allElements.forEach((row) => {
            documentManager.delete(row.id)
          })
        }
      }
    }

    if (!env('VCV_JS_FT_ROW_COLUMN_LOGIC_REFACTOR')) {
      if (elementData.tag === 'row') {
        if (elementData.layout && elementData.layout.layoutData && (Object.prototype.hasOwnProperty.call(elementData.layout.layoutData, 'all') || Object.prototype.hasOwnProperty.call(elementData.layout.layoutData, 'xs'))) {
          rebuildRawLayout(elementData.id, { layout: elementData.layout.layoutData })
          elementData.layout.layoutData = undefined
          wrap = false // Skip initChildren adding
        } else {
          rebuildRawLayout(elementData.id)
        }
      }
    }

    const data = documentManager.create(elementData, {
      insertAfter: options && options.insertAfter ? options.insertAfter : false
    })

    const initChildren = cookElement.get('initChildren')
    const isChildVisible = getChildVisibility(cookElement)

    if (wrap && initChildren && initChildren.length && !options.skipInitialExtraElements && isChildVisible) {
      setInitChildren(initChildren, data.id, '', null)
    }

    if (!env('VCV_JS_FT_ROW_COLUMN_LOGIC_REFACTOR')) {
      if (data.tag === 'column') {
        const rowElement = getParent(data)
        rebuildRawLayout(rowElement.id, { disableStacking: rowElement.layout.disableStacking })
        storage.trigger('update', rowElement.id, rowElement, '', options)
      }
    }

    if (!options.silent) {
      storage.state('elementAdd').set(data)
      if (!wrap && data.parent) {
        storage.trigger(`element:${data.parent}`, documentManager.get(data.parent), 'storage', options)
      } else {
        storage.state('document').set(documentManager.children(false))
      }
      updateTimeMachine()
    }
  })
  storage.on('update', (id, element, source = '', options = {}) => {
    innerAPI.dispatch('elementUpdate', id, element)
    options = Object.assign({ disableUpdateAssets: false, disableUpdateComponent: false }, options)
    const cookElement = cook.getById(id)
    if (!cookElement) {
      return
    }
    const currentElement = cookElement.toJS()
    if (currentElement.customHeaderTitle !== element.customHeaderTitle) {
      cacheStorage.trigger('clear', 'controls')
    }
    if (!env('VCV_JS_FT_ROW_COLUMN_LOGIC_REFACTOR')) {
      if (element.tag === 'row' && element.layout && element.layout.layoutData && (Object.prototype.hasOwnProperty.call(element.layout.layoutData, 'all') || Object.prototype.hasOwnProperty.call(element.layout.layoutData, 'xs'))) {
        rebuildRawLayout(id, { layout: element.layout.layoutData, disableStacking: element.layout.disableStacking })
        element.layout.layoutData = undefined
      }
    }

    const updatedCookElement = cook.get(element)
    const initChildren = updatedCookElement.get('initChildren')
    const isChildVisible = getChildVisibility(updatedCookElement)
    const dependencyProperty = cookElement.settings('initChildren').settings?.options?.visibilityDependency

    // If dependency toggle is on, but children don't exist in document, add child element
    if (initChildren && !documentManager.children(id).length && isChildVisible) {
      setInitChildren(initChildren, id, '', null)
      // Trigger state update to update TreeView attribute in EditForm
      storage.state('document').set(documentManager.children(false))
    } else if (initChildren && documentManager.children(id).length && !isChildVisible && dependencyProperty) {
    // If dependency toggle is off, but children exist in document, remove child element
      documentManager.children(id).forEach(child => storage.trigger('remove', child.id))
    }
    documentManager.update(id, element)

    if (!env('VCV_JS_FT_ROW_COLUMN_LOGIC_REFACTOR')) {
      if (element.tag === 'column') {
        window.setTimeout(() => {
          const rowElement = getParent(element)
          rebuildRawLayout(rowElement.id, { disableStacking: rowElement.layout.disableStacking })
          storage.trigger('update', rowElement.id, rowElement, '', options)
        }, 0)
      }
    }

    const { disableUpdateAssets } = options || {}
    if (disableUpdateAssets !== true) {
      assetsStorage.trigger('updateElement', id, options)
    }

    if (options && options.action && options.action === 'hide' && element.parent) {
      storage.trigger(`element:${element.parent}`, documentManager.get(element.parent), source, options)
    }
    if (cookElement.get('parentWrapper')) {
      const parent = documentManager.get(element.parent)
      storage.trigger('update', parent.id, parent)
    }
    if (!options.silent) {
      updateTimeMachine(source || 'elements')
    }
  })
  storage.on('remove', (id, options = {}) => {
    const element = documentManager.get(id)
    if (!element) {
      return
    }

    // Remove all jobs from assets storage state
    const childrenIds = Object.keys(documentManager.getDescendants(id))
    childrenIds.forEach(childId => assetsStorage.trigger('removeElement', childId))

    let parent = element && element.parent ? documentManager.get(element.parent) : false
    documentManager.delete(id)
    const initChildren = parent && cook.get(parent).get('initChildren')
    const hasDependencyProperty = parent && cook.get(parent).settings('initChildren').settings?.options?.visibilityDependency
    // remove parent if it must have children by default but doesn't have a dependency (initChildren)
    if (parent && initChildren && initChildren.length && !documentManager.children(parent.id).length && !hasDependencyProperty) {
      storage.trigger('remove', parent.id)
      // close editForm if deleted element is opened in edit form
      const settings = workspaceStorage.state('settings').get()
      if (settings && settings.action === 'edit' && settings.id && (parent.id === settings.id)) {
        workspaceStorage.state('settings').set(false)
      }
      parent = parent.parent ? documentManager.get(parent.parent) : false
    } else if (element.tag === 'column') {
      const rowElement = documentManager.get(parent.id)
      if (!env('VCV_JS_FT_ROW_COLUMN_LOGIC_REFACTOR')) {
        rebuildRawLayout(rowElement.id, { disableStacking: rowElement.layout.disableStacking })
      }
      storage.trigger('update', rowElement.id, documentManager.get(parent.id))
    }

    if (parent && element.tag !== 'column') {
      storage.trigger(`element:${parent.id}`, parent)
    } else {
      storage.state('document').set(documentManager.children(false))
    }
    if (!options.silent) {
      updateTimeMachine()
    }
  })
  storage.on('clone', (id) => {
    const breakBeforeClone = storage.action('beforeClone', id)
    if (breakBeforeClone) {
      return
    }
    const dolly = documentManager.clone(id)
    if (!env('VCV_JS_FT_ROW_COLUMN_LOGIC_REFACTOR')) {
      if (dolly.tag === 'column') {
        const rowElement = documentManager.get(dolly.parent)
        rebuildRawLayout(rowElement.id, { disableStacking: rowElement.layout.disableStacking })
        storage.trigger('update', rowElement.id, rowElement)
      }
    }
    if (dolly.parent) {
      storage.trigger(`element:${dolly.parent}`, documentManager.get(dolly.parent))
    } else {
      storage.state('document').set(documentManager.children(false))
    }
    updateTimeMachine()
  })
  storage.on('move', (id, data) => {
    const element = documentManager.get(id)
    const oldParent = element.parent
    if (data.action === 'after') {
      documentManager.moveAfter(id, data.related)
    } else if (data.action === 'append') {
      documentManager.appendTo(id, data.related)
    } else {
      documentManager.moveBefore(id, data.related)
    }
    storage.trigger(`element:move:${id}`, element)
    if (element.tag === 'column') {
      // rebuild previous column
      const rowElement = documentManager.get(element.parent)
      if (!env('VCV_JS_FT_ROW_COLUMN_LOGIC_REFACTOR')) {
        rebuildRawLayout(element.parent, { disableStacking: rowElement.layout.disableStacking })
      }
      // rebuild next column
      const newElement = documentManager.get(id)
      const newRowElement = documentManager.get(newElement.parent)
      if (!env('VCV_JS_FT_ROW_COLUMN_LOGIC_REFACTOR')) {
        rebuildRawLayout(newElement.parent, { disableStacking: newRowElement.layout && newRowElement.layout.disableStacking })
      }
    }
    const updatedElement = documentManager.get(id)
    if (oldParent && updatedElement.parent) {
      storage.trigger(`element:${oldParent}`, documentManager.get(oldParent))
      if (oldParent !== updatedElement.parent) {
        storage.trigger(`element:${updatedElement.parent}`, documentManager.get(updatedElement.parent))
        // Update workspace element
        const settings = workspaceStorage.state('settings').get()
        if (settings && settings.action === 'edit') {
          const options = settings.options && settings.options.nestedAttr ? settings.options : ''
          const activeTab = settings.options && settings.options.activeTab ? settings.options.activeTab : ''
          workspaceStorage.trigger('edit', id, activeTab, options)
        }
      }
    } else {
      storage.state('document').set(documentManager.children(false))
    }

    if (!data?.options?.silent) {
      updateTimeMachine()
    }
  })
  const mergeChildrenLayout = (data, parent, wrap = false) => {
    const children = Object.keys(data).filter((key) => {
      const element = data[key]
      return parent ? element.parent === parent : element.parent === '' || element.parent === parent
    })
    children.sort((a, b) => {
      if (typeof data[a].order === 'undefined') {
        data[a].order = 0
      }
      if (typeof data[b].order === 'undefined') {
        data[b].order = 0
      }
      return data[a].order - data[b].order
    })
    children.forEach((key) => {
      const element = data[key]
      const newId = utils.createKey()
      const oldId = '' + element.id
      if (substituteIds[oldId]) {
        element.id = substituteIds[oldId]
      } else {
        substituteIds[oldId] = newId
        element.id = newId
      }
      if (element.parent && substituteIds[element.parent]) {
        element.parent = substituteIds[element.parent]
      } else if (element.parent && !substituteIds[element.parent]) {
        substituteIds[element.parent] = utils.createKey()
        element.parent = substituteIds[element.parent]
      }
      delete element.order

      storage.trigger('add', element, wrap, { silent: true, action: 'merge', skipInitialExtraElements: true })
      mergeChildrenLayout(data, oldId, wrap)
    })
  }
  storage.on('merge', (content, wrap) => {
    const layoutData = JSON.parse(JSON.stringify(content))
    const editorType = dataManager.get('editorType')
    mergeChildrenLayout(layoutData, false, editorType === 'popup' || wrap)
    storage.state('document').set(documentManager.children(false), content)
    substituteIds = {}
    updateTimeMachine()
  }, {
    debounce: 250,
    async: true
  })
  storage.on('reset', (data) => {
    const sanitizedData = sanitizeData(data, true)
    documentManager.reset(sanitizedData)
    historyStorage.trigger('init', sanitizedData)
    storage.state('document').set(documentManager.children(false), sanitizedData)
  })
  storage.on('updateAll', (data) => {
    documentManager.reset(sanitizeData(data))
    storage.state('document').set(documentManager.children(false), data)
  })
  storage.on('replace', (id, elementData, options = {}) => {
    const element = documentManager.get(id)
    if (!element) {
      return
    }
    const createdElements = []
    const cookElement = cook.get(elementData)
    if (!cookElement) {
      return
    }

    elementData = getElementToJS(cookElement)
    const data = documentManager.create(elementData, {
      insertAfter: false,
      // used to insert element with same order in parent
      insertInstead: true
    })
    createdElements.push(data.id)

    const children = documentManager.children(id)
    if (cookElement.containerFor()) {
      const childTag = cookElement.settings('containerFor').settings && cookElement.settings('containerFor').settings.options && cookElement.settings('containerFor').settings.options.elementDependencies && cookElement.settings('containerFor').settings.options.elementDependencies.tag
      if (children && childTag) {
        children.forEach(child => {
          const childId = child.id
          const childCookElement = cook.get(child)
          const editFormTabSettings = childCookElement.filter((key, value, settings) => {
            return settings.access === 'public'
          })
          const replaceElementMergeData = {
            tag: childTag,
            parent: cookElement.get('id')
          }
          editFormTabSettings.forEach(key => {
            replaceElementMergeData[key] = child[key]
          })
          storage.trigger('replace', childId, replaceElementMergeData)
        })
      } else if (children) {
        appendChildren(children, cookElement)
      }
    } else if (children) {
      appendChildren(children, cookElement)
    }

    documentManager.delete(id)

    if (!options.silent) {
      storage.state('elementReplace').set({ id, data })
      storage.state('document').set(documentManager.children(false))
      updateTimeMachine()
    }
  })
  storage.on('addHtmlString', (id, ref) => {
    const htmlStringState = storage.state('htmlStrings').get() || {}
    htmlStringState[id] = ref
    storage.state('htmlStrings').set(htmlStringState)
  })
  storage.on('removeHtmlString', (id) => {
    const htmlStringState = storage.state('htmlStrings').get() || {}
    delete htmlStringState[id]
    storage.state('htmlStrings').set(htmlStringState)
  })
  storage.on('updateTimeMachine', updateTimeMachine)

  // Remove previously loaded page assets as they are rebuild from scratch.
  storage.on('elementsCssBuildDone', function () {
    const removeAssetsFile = () => {
      const source = dataManager.get('sourceID')
      const assetsFrontStyle = env('iframe').document.getElementById(`vcv:assets:front:style:${source}-inline-css`)
      if (assetsFrontStyle) {
        assetsFrontStyle.parentNode.removeChild(assetsFrontStyle)
      }
    }
    // Remove after a second (css should be completely loaded and rebuild)
    window.setTimeout(removeAssetsFile, 1000)
  })

  const renderDone = debounce(() => {
    storage.trigger('elementsRenderDone')
  }, 200)

  const moduleLayoutApi = new ModuleAPI('contentLayout')
  storage.on('elementsCssBuildDone', () => {
    moduleLayoutApi.on('element:didUpdate', renderDone)
    renderDone()
  })
})
