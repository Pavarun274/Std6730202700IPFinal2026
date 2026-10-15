import React, { useState, useEffect, useCallback, useRef } from 'react';
import {
  View, Text, TextInput, TouchableOpacity, FlatList, Alert, Platform,
  ActivityIndicator, StyleSheet, SafeAreaView, KeyboardAvoidingView,
} from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { API_URL } from './config';

// Alert.alert with buttons does not work on web, so fall back to window.confirm / alert.
const notify = (title, msg) =>
  Platform.OS === 'web' ? window.alert(`${title}\n${msg || ''}`) : Alert.alert(title, msg);

const confirmDialog = (title, msg, onConfirm) => {
  if (Platform.OS === 'web') {
    if (window.confirm(`${title}\n${msg}`)) onConfirm();
    return;
  }
  Alert.alert(title, msg, [
    { text: 'Cancel', style: 'cancel' },
    { text: 'Delete', style: 'destructive', onPress: onConfirm },
  ]);
};

// Authenticated fetch: always sends the Bearer token; 401 -> back to Login.
function makeApi(token, onUnauthorized) {
  return async (path, options = {}) => {
    const res = await fetch(`${API_URL}${path}`, {
      ...options,
      headers: { ...(options.headers || {}), Authorization: `Bearer ${token}` },
    });
    if (res.status === 401) {
      onUnauthorized();
      throw new Error('unauthorized');
    }
    return res;
  };
}

const C = {
  bg: '#FAFAFA', card: '#FFFFFF', text: '#111111', muted: '#6B7280', border: '#E5E7EB',
  accent: '#111111', danger: '#DC2626', gray: '#F3F4F6',
  success: '#047857', successBg: '#ECFDF5', warning: '#B45309', warningBg: '#FFFBEB',
};
const R = 10;

// Labeled text input (styling only).
function Field({ label, right, style, ...props }) {
  const [focused, setFocused] = useState(false);
  return (
    <View style={{ marginBottom: 16 }}>
      <Text style={s.label}>{label}</Text>
      <View style={[s.inputWrap, focused && s.inputFocused]}>
        <TextInput
          placeholderTextColor="#9CA3AF"
          {...props}
          style={[s.input, style]}
          onFocus={() => setFocused(true)}
          onBlur={() => setFocused(false)}
        />
        {right}
      </View>
    </View>
  );
}

function LoginScreen({ onLogin }) {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [showPw, setShowPw] = useState(false);

  const submit = async () => {
    if (!username.trim() || !password) {
      return notify('Login failed', 'Please enter username and password.');
    }
    setLoading(true);
    try {
      const res = await fetch(`${API_URL}/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username: username.trim(), password }),
      });
      const data = await res.json();
      if (res.ok && data.success) onLogin(data.token);
      else notify('Login failed', data.message || 'Invalid credentials');
    } catch (e) {
      if (e.message === 'unauthorized') return;
      notify('Network error', 'Cannot reach the server. Is the backend running?');
    } finally {
      setLoading(false);
    }
  };

  return (
    <SafeAreaView style={s.loginRoot}>
      <View style={s.center}>
        <View style={s.loginCard}>
          <Text style={s.loginTitle}>HR Manager</Text>
          <Text style={s.subtitle}>Employee & salary analytics</Text>
          <Field label="Username" placeholder="Username" autoCapitalize="none"
            value={username} onChangeText={setUsername} />
          <Field label="Password" placeholder="Password" secureTextEntry={!showPw}
            value={password} onChangeText={setPassword} onSubmitEditing={submit}
            right={
              <TouchableOpacity onPress={() => setShowPw((v) => !v)} hitSlop={8}>
                <Text style={s.textBtn}>{showPw ? 'Hide' : 'Show'}</Text>
              </TouchableOpacity>
            } />
          <TouchableOpacity style={[s.btn, loading && s.btnDisabled]} onPress={submit} disabled={loading}>
            {loading ? <ActivityIndicator color="#fff" /> : <Text style={s.btnText}>Login</Text>}
          </TouchableOpacity>
          <Text style={s.hint}>Demo: admin / password123</Text>
        </View>
      </View>
    </SafeAreaView>
  );
}

function DashboardScreen({ token, onLogout }) {
  const api = makeApi(token, () => {
    notify('Session expired', 'Please log in again.');
    onLogout();
  });
  const [employees, setEmployees] = useState([]); // list shown (filtered by search)
  const [allEmployees, setAllEmployees] = useState([]); // always the full list (stats)
  const [search, setSearch] = useState('');
  const searchRef = useRef('');
  const [listLoading, setListLoading] = useState(true);
  const [name, setName] = useState('');
  const [position, setPosition] = useState('');
  const [salary, setSalary] = useState('');
  const [clusters, setClusters] = useState(null);
  const [analyzing, setAnalyzing] = useState(false);
  const [addOpen, setAddOpen] = useState(true);
  const [editId, setEditId] = useState(null);
  const [editName, setEditName] = useState('');
  const [editPosition, setEditPosition] = useState('');
  const [editSalary, setEditSalary] = useState('');

  const load = useCallback(async () => {
    try {
      const q = searchRef.current.trim();
      const fullRes = await api('/employees');
      const full = await fullRes.json();
      setAllEmployees(full);
      if (q) {
        const res = await api(`/employees?search=${encodeURIComponent(q)}`);
        // Ignore stale responses if the search text changed meanwhile.
        if (searchRef.current.trim() === q) setEmployees(await res.json());
      } else {
        setEmployees(full);
      }
    } catch (e) {
      if (e.message === 'unauthorized') return;
      notify('Network error', 'Failed to load employees.');
    } finally {
      setListLoading(false);
    }
  }, []);

  // Initial load immediately; afterwards debounce 300ms while the user types.
  const firstRun = useRef(true);
  useEffect(() => {
    searchRef.current = search;
    if (firstRun.current) {
      firstRun.current = false;
      load();
      return undefined;
    }
    const t = setTimeout(load, 300);
    return () => clearTimeout(t);
  }, [search, load]);

  const addEmployee = async () => {
    const sal = Number(salary);
    if (!name.trim() || !position.trim() || !salary.trim()) {
      return notify('Validation', 'Name, position and salary are required.');
    }
    if (!Number.isFinite(sal) || sal <= 0) {
      return notify('Validation', 'Salary must be a positive number.');
    }
    try {
      const res = await api('/employees', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: name.trim(), position: position.trim(), salary: sal }),
      });
      if (!res.ok) {
        const d = await res.json();
        return notify('Error', d.message || 'Could not add employee');
      }
      setName(''); setPosition(''); setSalary('');
      setClusters(null);
      load();
    } catch (e) {
      if (e.message === 'unauthorized') return;
      notify('Network error', 'Failed to add employee.');
    }
  };

  const startEdit = (emp) => {
    setEditId(emp.id);
    setEditName(emp.name);
    setEditPosition(emp.position);
    setEditSalary(String(emp.salary));
  };
  const cancelEdit = () => setEditId(null);

  const saveEdit = async () => {
    const sal = Number(editSalary);
    if (!editName.trim() || !editPosition.trim() || !editSalary.trim()) {
      return notify('Validation', 'Name, position and salary are required.');
    }
    if (!Number.isFinite(sal) || sal <= 0) {
      return notify('Validation', 'Salary must be a positive number.');
    }
    try {
      const res = await api(`/employees/${editId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: editName.trim(), position: editPosition.trim(), salary: sal }),
      });
      if (!res.ok) {
        const d = await res.json().catch(() => ({}));
        return notify('Error', d.message || 'Could not update employee');
      }
      setEditId(null);
      setClusters(null);
      load();
    } catch (e) {
      if (e.message === 'unauthorized') return;
      notify('Network error', 'Failed to update employee.');
    }
  };

  const toggleStatus = async (id) => {
    try {
      const res = await api(`/employees/${id}/status`, { method: 'PUT' });
      if (!res.ok) return notify('Error', 'Could not update status');
      load();
    } catch (e) {
      if (e.message === 'unauthorized') return;
      notify('Network error', 'Failed to update status.');
    }
  };

  const remove = (emp) =>
    confirmDialog('Are you sure?', `Delete ${emp.name}?`, async () => {
      try {
        const res = await api(`/employees/${emp.id}`, { method: 'DELETE' });
        if (!res.ok) return notify('Error', 'Could not delete employee');
        if (editId === emp.id) setEditId(null);
        setClusters(null);
        load();
      } catch (e) {
        if (e.message === 'unauthorized') return;
        notify('Network error', 'Failed to delete employee.');
      }
    });

  const analyze = async () => {
    setAnalyzing(true);
    try {
      const res = await api('/employees/salary-clusters');
      const data = await res.json();
      if (res.ok && data.success) setClusters(data.clusters);
      else notify('Error', 'Could not analyze salaries');
    } catch (e) {
      if (e.message === 'unauthorized') return;
      notify('Network error', 'Failed to fetch clusters.');
    } finally {
      setAnalyzing(false);
    }
  };

  const total = allEmployees.length;
  const activeCount = allEmployees.filter((e) => e.status === 'Active').length;
  const leaveCount = allEmployees.filter((e) => e.status === 'On Leave').length;
  const initials = (n) =>
    String(n).trim().split(/\s+/).slice(0, 2).map((w) => (w[0] || '').toUpperCase()).join('');
  const clusterTotal = clusters ? clusters.reduce((sum, c) => sum + c.count, 0) : 0;

  const header = (
    <View style={[s.page, s.pagePad]}>
      <View style={s.headerRow}>
        <Text style={s.title}>HR Manager</Text>
        <TouchableOpacity onPress={onLogout} hitSlop={8}>
          <Text style={s.textBtn}>Logout</Text>
        </TouchableOpacity>
      </View>

      <View style={s.statsRow}>
        {[
          { label: 'Total', n: total },
          { label: 'Active', n: activeCount },
          { label: 'On Leave', n: leaveCount },
        ].map((x) => (
          <View key={x.label} style={s.stat}>
            <Text style={s.statLabel}>{x.label}</Text>
            <Text style={s.statNum}>{x.n}</Text>
          </View>
        ))}
      </View>

      <View style={s.card}>
        <TouchableOpacity style={s.collapseRow} onPress={() => setAddOpen((v) => !v)} activeOpacity={0.7}>
          <Text style={s.cardTitle}>Add employee</Text>
          <Text style={s.textBtn}>{addOpen ? 'Hide' : 'Show'}</Text>
        </TouchableOpacity>
        {addOpen && (
          <View style={{ marginTop: 16 }}>
            <Field label="Name" placeholder="Full name" value={name} onChangeText={setName} />
            <Field label="Position" placeholder="Job title" value={position} onChangeText={setPosition} />
            <Field label="Salary" placeholder="e.g. 45000" keyboardType="numeric"
              value={salary} onChangeText={setSalary} />
            <TouchableOpacity style={s.btn} onPress={addEmployee}>
              <Text style={s.btnText}>Add employee</Text>
            </TouchableOpacity>
          </View>
        )}
      </View>

      <Text style={s.sectionTitle}>Salary structure</Text>
      <TouchableOpacity style={[s.btn, analyzing && s.btnDisabled, { marginBottom: 16 }]} onPress={analyze} disabled={analyzing}>
        {analyzing ? <ActivityIndicator color="#fff" /> : <Text style={s.btnText}>Analyze salary structure</Text>}
      </TouchableOpacity>
      {clusters && !analyzing && clusters.length === 0 && (
        <Text style={s.emptyText}>No data</Text>
      )}
      {clusters && !analyzing && clusters.length > 0 && (
        <View>
          {clusters.map((c) => {
            const pct = clusterTotal ? (c.count / clusterTotal) * 100 : 0;
            return (
              <View key={c.group} style={s.card}>
                <View style={s.tierTop}>
                  <Text style={s.tier}>{c.group}</Text>
                  <Text style={s.muted}>{c.count} employees</Text>
                </View>
                <Text style={s.bigNum}>฿{Math.round(c.centroid).toLocaleString()}</Text>
                <Text style={s.small}>average salary</Text>
                <View style={s.barTrack}>
                  <View style={[s.barFill, { width: `${pct}%` }]} />
                </View>
              </View>
            );
          })}
        </View>
      )}

      <Text style={[s.sectionTitle, { marginTop: 8 }]}>Employees ({employees.length})</Text>
      <View style={s.searchWrap}>
        <TextInput
          style={s.searchInput}
          placeholder="Search name or position"
          placeholderTextColor="#9CA3AF"
          value={search}
          onChangeText={setSearch}
          autoCapitalize="none"
          autoCorrect={false}
        />
        {search.length > 0 && (
          <TouchableOpacity onPress={() => setSearch('')} hitSlop={8}>
            <Text style={s.textBtn}>Clear</Text>
          </TouchableOpacity>
        )}
      </View>
      {listLoading && <ActivityIndicator color={C.text} style={{ margin: 12 }} />}
      {!listLoading && employees.length === 0 && (
        <Text style={s.emptyText}>No employees found</Text>
      )}
    </View>
  );

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: C.bg }}>
      <KeyboardAvoidingView style={{ flex: 1, backgroundColor: C.bg }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <FlatList
          contentContainerStyle={{ paddingBottom: 32 }}
          data={employees}
          extraData={[editId, editName, editPosition, editSalary]}
          keyExtractor={(e) => e.id}
          ListHeaderComponent={header}
          keyboardShouldPersistTaps="handled"
          renderItem={({ item }) => {
            const editing = editId === item.id;
            return (
              <View style={[s.page, s.pagePad]}>
                <View style={s.card}>
                  {editing ? (
                    <View>
                      <Field label="Name" value={editName} onChangeText={setEditName} />
                      <Field label="Position" value={editPosition} onChangeText={setEditPosition} />
                      <Field label="Salary" keyboardType="numeric" value={editSalary} onChangeText={setEditSalary} />
                      <View style={s.actions}>
                        <TouchableOpacity style={s.smallPrimary} onPress={saveEdit}>
                          <Text style={s.smallPrimaryText}>Save</Text>
                        </TouchableOpacity>
                        <TouchableOpacity style={s.smallBtn} onPress={cancelEdit}>
                          <Text style={s.smallBtnText}>Cancel</Text>
                        </TouchableOpacity>
                      </View>
                    </View>
                  ) : (
                    <View>
                      <View style={s.itemTop}>
                        <View style={s.avatar}>
                          <Text style={s.avatarText}>{initials(item.name)}</Text>
                        </View>
                        <View style={{ flex: 1 }}>
                          <Text style={s.name}>{item.name}</Text>
                          <Text style={s.muted}>{item.position}</Text>
                        </View>
                        <View style={s.salaryCol}>
                          <Text style={s.salaryText}>฿{Number(item.salary).toLocaleString()}</Text>
                          <View style={[s.pill, item.status === 'Active' ? s.pillActive : s.pillLeave]}>
                            <Text style={[s.pillText, { color: item.status === 'Active' ? C.success : C.warning }]}>
                              {item.status}
                            </Text>
                          </View>
                        </View>
                      </View>
                      <View style={s.actions}>
                        <TouchableOpacity style={s.smallBtn} onPress={() => startEdit(item)}>
                          <Text style={s.smallBtnText}>Edit</Text>
                        </TouchableOpacity>
                        <TouchableOpacity style={s.smallBtn} onPress={() => toggleStatus(item.id)}>
                          <Text style={s.smallBtnText}>Toggle</Text>
                        </TouchableOpacity>
                        <TouchableOpacity style={s.smallBtn} onPress={() => remove(item)}>
                          <Text style={[s.smallBtnText, { color: C.danger }]}>Delete</Text>
                        </TouchableOpacity>
                      </View>
                    </View>
                  )}
                </View>
              </View>
            );
          }}
        />
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

export default function App() {
  const [token, setToken] = useState(null);
  return (
    <View style={s.root}>
      <StatusBar style="dark" />
      {token ? <DashboardScreen token={token} onLogout={() => setToken(null)} /> : <LoginScreen onLogin={setToken} />}
    </View>
  );
}

const s = StyleSheet.create({
  root: { flex: 1, backgroundColor: C.bg, paddingTop: Platform.OS === 'android' ? 30 : 0 },
  loginRoot: { flex: 1, backgroundColor: C.bg },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: 16 },
  page: { width: '100%', maxWidth: 720, alignSelf: 'center' },
  pagePad: { paddingHorizontal: 16 },
  card: { backgroundColor: C.card, borderRadius: R, borderWidth: 1, borderColor: C.border, padding: 16, marginBottom: 12 },
  cardTitle: { fontSize: 16, fontWeight: '600', color: C.text },
  loginCard: { width: '100%', maxWidth: 400, backgroundColor: C.card, borderRadius: R, borderWidth: 1, borderColor: C.border, padding: 32 },
  loginTitle: { fontSize: 24, fontWeight: '700', color: C.text },
  subtitle: { fontSize: 14, color: C.muted, marginTop: 4, marginBottom: 32 },
  hint: { color: C.muted, fontSize: 12, marginTop: 16 },
  headerRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: 24 },
  title: { fontSize: 24, fontWeight: '700', color: C.text },
  textBtn: { color: C.muted, fontSize: 14, fontWeight: '500' },
  statsRow: { flexDirection: 'row', gap: 12, marginBottom: 12 },
  stat: { flex: 1, backgroundColor: C.card, borderRadius: R, borderWidth: 1, borderColor: C.border, padding: 16 },
  statNum: { fontSize: 28, fontWeight: '700', color: C.text, marginTop: 4 },
  statLabel: { color: C.muted, fontSize: 12, fontWeight: '500' },
  sectionTitle: { fontSize: 18, fontWeight: '600', color: C.text, marginTop: 12, marginBottom: 12 },
  muted: { color: C.muted, fontSize: 14 },
  small: { color: C.muted, fontSize: 12 },
  collapseRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  label: { fontSize: 12, fontWeight: '500', color: C.muted, marginBottom: 6 },
  inputWrap: { flexDirection: 'row', alignItems: 'center', borderWidth: 1, borderColor: C.border, borderRadius: R, backgroundColor: '#fff', paddingHorizontal: 12 },
  inputFocused: { borderColor: C.accent },
  input: { flex: 1, paddingVertical: 11, fontSize: 14, color: C.text, outlineStyle: 'none' },
  btn: { backgroundColor: C.accent, paddingVertical: 13, borderRadius: R, alignItems: 'center', width: '100%' },
  btnDisabled: { opacity: 0.6 },
  btnText: { color: '#fff', fontWeight: '600', fontSize: 14 },
  tierTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 },
  tier: { fontWeight: '600', fontSize: 14, color: C.text },
  bigNum: { fontSize: 28, fontWeight: '700', color: C.text },
  barTrack: { height: 4, borderRadius: 2, backgroundColor: C.gray, marginTop: 12, overflow: 'hidden' },
  barFill: { height: 4, borderRadius: 2, backgroundColor: '#9CA3AF' },
  searchWrap: { flexDirection: 'row', alignItems: 'center', backgroundColor: C.card, borderRadius: R, borderWidth: 1, borderColor: C.border, paddingHorizontal: 12, marginBottom: 12 },
  searchInput: { flex: 1, paddingVertical: 11, fontSize: 14, color: C.text, outlineStyle: 'none' },
  emptyText: { color: C.muted, fontSize: 14, textAlign: 'center', paddingVertical: 24 },
  itemTop: { flexDirection: 'row', alignItems: 'center' },
  avatar: { width: 44, height: 44, borderRadius: 22, backgroundColor: C.gray, alignItems: 'center', justifyContent: 'center', marginRight: 12 },
  avatarText: { color: C.text, fontWeight: '600', fontSize: 14 },
  name: { fontWeight: '600', fontSize: 16, color: C.text, marginBottom: 2 },
  salaryCol: { alignItems: 'flex-end', marginLeft: 8 },
  salaryText: { fontWeight: '600', fontSize: 16, color: C.text },
  pill: { borderRadius: 999, paddingVertical: 2, paddingHorizontal: 8, marginTop: 6 },
  pillActive: { backgroundColor: C.successBg },
  pillLeave: { backgroundColor: C.warningBg },
  pillText: { fontSize: 12, fontWeight: '600' },
  actions: { flexDirection: 'row', gap: 8, marginTop: 16 },
  smallBtn: { borderWidth: 1, borderColor: C.border, borderRadius: R, paddingVertical: 7, paddingHorizontal: 14 },
  smallBtnText: { color: C.text, fontWeight: '500', fontSize: 13 },
  smallPrimary: { backgroundColor: C.accent, borderRadius: R, paddingVertical: 7, paddingHorizontal: 14 },
  smallPrimaryText: { color: '#fff', fontWeight: '500', fontSize: 13 },
});
