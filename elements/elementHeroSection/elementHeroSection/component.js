import React from 'react'
import { getService } from 'vc-cake'
import classNames from 'classnames'

const vcvAPI = getService('api')

export default class HeroSectionElement extends vcvAPI.elementComponent {
  componentDidMount () {
    vcvAPI.publicEvents.trigger('heroSectionReady')
  }

  render () {
    const { id, atts, editor, children } = this.props
    const { description, align, customClass, metaCustomId, extraDataAttributes } = atts

    // Handle conditional classes
    const containerClasses = classNames({
      'vce-hero-section-container': true,
      'vce-hero-section-media--xs': true
    })

    const elementClasses = classNames({
      'vce': true,
      'vce-hero-section': true,
      'vce-hero-section--alignment-start': align === 'start',
      'vce-hero-section--alignment-end': align === 'end',
      [customClass]: typeof customClass === 'string' && customClass
    })

    // Handle conditional props
    const containerProps = this.getExtraDataAttributes(extraDataAttributes)
    metaCustomId && (containerProps.id = metaCustomId)

    // Handle design options
    const doRest = this.applyDO('margin background border animation')
    const doPadding = this.applyDO('padding')

    return (
      <section className={containerClasses} {...editor} {...containerProps}>
        <div className={elementClasses} id={'el-' + id} {...doRest}>
          <div className="vce-hero-section--content" {...doPadding}>
            {description}
            {children}
          </div>
        </div>
      </section>
    )
  }
}
