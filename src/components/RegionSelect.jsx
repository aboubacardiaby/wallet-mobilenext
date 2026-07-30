import PickerModal from './PickerModal'

// Region options depend on the currently selected country — see useRegions().
// `value`/`onChange` deal in region names, same free-text convention as
// CountrySelect, so the backend keeps treating `region` as plain text.
export default function RegionSelect({ value, onChange, options, placeholder = 'Select region' }) {
  return (
    <PickerModal
      value={value}
      onChange={onChange}
      options={options}
      placeholder={placeholder}
      keyField="name"
      labelField="name"
    />
  )
}
