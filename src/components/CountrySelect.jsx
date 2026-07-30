import { Text, StyleSheet } from 'react-native'
import PickerModal from './PickerModal'

// `value`/`onChange` deal in country names to match the free-text
// nationality/country fields on the backend.
export default function CountrySelect({ value, onChange, options, placeholder = 'Select country' }) {
  return (
    <PickerModal
      value={value}
      onChange={onChange}
      options={options}
      placeholder={placeholder}
      keyField="code"
      labelField="name"
      renderLeading={c => <Text style={s.flag}>{c.flag}</Text>}
    />
  )
}

const s = StyleSheet.create({
  flag: { fontSize: 18, width: 26, textAlign: 'center' },
})
