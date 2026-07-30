import { useState } from 'react'
import {
  View, Text, TextInput, TouchableOpacity, StyleSheet,
  FlatList, Modal, SafeAreaView,
} from 'react-native'
import { ChevronDown, Search, X } from 'lucide-react-native'

// Shared chrome for "compact trigger + full-screen searchable list" pickers.
// `keyField`/`labelField` name the option's identity/display keys, and
// `renderLeading(item)` renders optional per-row content (e.g. a flag emoji)
// before the label, both in the trigger and in each list row.
export default function PickerModal({
  value, onChange, options, placeholder = 'Select',
  keyField = 'code', labelField = 'name', renderLeading,
}) {
  const [open, setOpen] = useState(false)
  const [search, setSearch] = useState('')

  const selected = options.find(o => o[labelField] === value)
  const filtered = search
    ? options.filter(o => o[labelField].toLowerCase().includes(search.toLowerCase()))
    : options

  const select = (o) => {
    onChange(o)
    setSearch('')
    setOpen(false)
  }

  return (
    <>
      <TouchableOpacity style={pm.trigger} onPress={() => setOpen(true)}>
        {selected ? (
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, flex: 1 }}>
            {renderLeading && renderLeading(selected)}
            <Text style={pm.triggerText} numberOfLines={1}>{selected[labelField]}</Text>
          </View>
        ) : (
          <Text style={pm.placeholder} numberOfLines={1}>{placeholder}</Text>
        )}
        <ChevronDown size={16} color="#9CA3AF" />
      </TouchableOpacity>

      <Modal visible={open} animationType="slide" onRequestClose={() => setOpen(false)}>
        <SafeAreaView style={pm.modal}>
          <View style={pm.modalHeader}>
            <Text style={pm.modalTitle}>{placeholder}</Text>
            <TouchableOpacity onPress={() => setOpen(false)} style={pm.closeBtn}>
              <X size={18} color="#374151" />
            </TouchableOpacity>
          </View>
          <View style={pm.searchBox}>
            <Search size={14} color="#9CA3AF" />
            <TextInput
              style={pm.searchInput}
              placeholder="Search…"
              placeholderTextColor="#9CA3AF"
              value={search}
              onChangeText={setSearch}
              autoFocus
            />
          </View>
          <FlatList
            data={filtered}
            keyExtractor={o => o[keyField]}
            keyboardShouldPersistTaps="handled"
            renderItem={({ item: o }) => (
              <TouchableOpacity style={pm.option} onPress={() => select(o)}>
                {renderLeading && renderLeading(o)}
                <Text style={pm.optionText}>{o[labelField]}</Text>
                {o[labelField] === value && <Text style={pm.optionCheck}>✓</Text>}
              </TouchableOpacity>
            )}
            ListEmptyComponent={<Text style={pm.empty}>No results found</Text>}
          />
        </SafeAreaView>
      </Modal>
    </>
  )
}

const pm = StyleSheet.create({
  trigger:      { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', backgroundColor: '#fff', borderWidth: 1.5, borderColor: '#E5E7EB', borderRadius: 14, paddingHorizontal: 14, paddingVertical: 12 },
  triggerText:  { fontSize: 14, color: '#111827', flexShrink: 1 },
  placeholder:  { fontSize: 14, color: '#9CA3AF' },
  modal:        { flex: 1, backgroundColor: '#fff' },
  modalHeader:  { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 20, paddingVertical: 14 },
  modalTitle:   { fontSize: 16, fontWeight: '700', color: '#111827' },
  closeBtn:     { width: 32, height: 32, borderRadius: 10, backgroundColor: '#F3F4F6', alignItems: 'center', justifyContent: 'center' },
  searchBox:    { flexDirection: 'row', alignItems: 'center', gap: 8, marginHorizontal: 20, marginBottom: 8, backgroundColor: '#F3F4F6', borderRadius: 12, paddingHorizontal: 12, paddingVertical: 10 },
  searchInput:  { flex: 1, fontSize: 14, color: '#111827' },
  option:       { flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: 20, paddingVertical: 14, borderBottomWidth: 1, borderBottomColor: '#F9FAFB' },
  optionText:   { fontSize: 14, fontWeight: '500', color: '#111827', flex: 1 },
  optionCheck:  { fontSize: 14, fontWeight: '700', color: '#4F46E5' },
  empty:        { textAlign: 'center', color: '#9CA3AF', marginTop: 40 },
})
