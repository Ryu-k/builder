/*eslint jsx-quotes: ["error", "prefer-double"]*/
import Attribute from '../attribute'
export default class Component extends Attribute {
  handleChange (event) {
    let value = event.target.value
    var values = this.state.value
    if (event.target.checked) {
      values.push(value)
    } else {
      values.splice(values.indexOf(value), 1)
    }
    this.setFieldValue(values)
  }

  render () {
    let { fieldKey } = this.props
    let optionElements = []
    let values = this.props.options.values
    let currentValues = this.state.value
    for (let key in values) {
      let value = values[ key ].value
      let checked = currentValues.indexOf(value) !== -1 ? 'checked' : ''
      optionElements.push(
        <label key={fieldKey + ':' + key + ':' + value} className="vc_ui-form-checkbox">
          <input type="checkbox" onChange={this.handleChange} checked={checked} value={value} />
          <span className="vc_ui-form-checkbox-indicator"></span>
          {values[ key ].label}
        </label>
      )
    }
    return (
      <div>
        {optionElements}
      </div>)
  }
}
