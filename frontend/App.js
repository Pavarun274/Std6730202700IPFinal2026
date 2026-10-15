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

// Labeled text input with a highlighted border while focused (styling only).
function Field({ label, style, ...props }) {
  const [focused, setFocused] = useState(false);
  return (
    <View>
      <Text style={s.label}>{label}</Text>
      <TextInput
        placeholderTextColor="#9CA3AF"
        {...props}
        style={[s.input, focused && s.inputFocused, style]}
        onFocus={() => setFocused(true)}
        onBlur={() => setFocused(false)}
      />
    </View>
  );
}

function LoginScreen({ onLogin }) {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);

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
    <SafeAreaView style={s.center}>
      <View style={[s.card, s.loginCard]}>
        <Text style={s.loginTitle}>HR Manager</Text>
        <Text style={s.subtitle}>Employee & Salary Analytics</Text>
        <Field label="Username" placeholder="Username" autoCapitalize="none"
          value={username} onChangeText={setUsername} />
        <Field label="Password" placeholder="Password" secureTextEntry
          value={password} onChangeText={setPassword} onSubmitEditing={submit} />
        <TouchableOpacity style={[s.btn, loading && s.btnDisabled]} onPress={submit} disabled={loading}>
          {loading ? <ActivityIndicator color="#fff" /> : <Text style={s.btnText}>Login</Text>}
        </TouchableOpacity>
        <Text style={s.hint}>Demo: admin / password123</Text>
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

  const activeCount = allEmployees.filter((e) => e.status === 'Active').length;
  const leaveCount = allEmployees.filter((e) => e.status === 'On Leave').length;
  const initials = (n) =>
    String(n).trim().split(/\s+/).slice(0, 2).map((w) => (w[0] || '').toUpperCase()).join('');
  const tierColors = ['#16A34A', '#4F46E5', '#D97706'];
  const avatarColors = ['#4F46E5', '#0EA5E9', '#16A34A', '#D97706', '#DB2777', '#7C3AED'];
  const avatarColor = (id) => avatarColors[parseInt(id, 10) % avatarColors.length || 0];

  const header = (
    <View>
      <View style={s.headerRow}>
        <View>
          <Text style={s.title}>Dashboard</Text>
          <Text style={s.muted}>{allEmployees.length} employees</Text>
        </View>
        <TouchableOpacity style={s.logout} onPress={onLogout}>
          <Text style={s.logoutText}>Logout</Text>
        </TouchableOpacity>
      </View>

      <View style={s.statsRow}>
        <View style={s.stat}><Text style={s.statNum}>{allEmployees.length}</Text><Text style={s.statLabel}>Total</Text></View>
        <View style={s.stat}><Text style={[s.statNum, { color: '#16A34A' }]}>{activeCount}</Text><Text style={s.statLabel}>Active</Text></View>
        <View style={s.stat}><Text style={[s.statNum, { color: '#D97706' }]}>{leaveCount}</Text><Text style={s.statLabel}>On Leave</Text></View>
      </View>

      <View style={s.card}>
        <Text style={s.section}>Add Employee</Text>
        <Field label="Name" placeholder="Full name" value={name} onChangeText={setName} />
        <Field label="Position" placeholder="Job title" value={position} onChangeText={setPosition} />
        <Field label="Salary" placeholder="e.g. 45000" keyboardType="numeric"
          value={salary} onChangeText={setSalary} />
        <TouchableOpacity style={s.btn} onPress={addEmployee}>
          <Text style={s.btnText}>Add Employee</Text>
        </TouchableOpacity>
      </View>

      <TouchableOpacity style={[s.btn, s.analyze, analyzing && s.btnDisabled]} onPress={analyze} disabled={analyzing}>
        {analyzing ? <ActivityIndicator color="#fff" /> : <Text style={s.btnText}>Analyze Salary Structure</Text>}
      </TouchableOpacity>
      {clusters && !analyzing && clusters.length === 0 && (
        <View style={s.card}><Text style={s.muted}>No data</Text></View>
      )}
      {clusters && !analyzing && clusters.length > 0 && (
        <View>
          {clusters.map((c, i) => (
            <View key={c.group} style={[s.card, s.tierCard, { borderLeftColor: tierColors[i % 3] }]}>
              <Text style={[s.tier, { color: tierColors[i % 3] }]}>{c.group}</Text>
              <Text style={s.bigNum}>฿{Math.round(c.centroid).toLocaleString()}</Text>
              <Text style={s.muted}>{c.count} employees</Text>
            </View>
          ))}
        </View>
      )}

      <Text style={s.section}>Employees ({employees.length})</Text>
      <View style={s.searchWrap}>
        <TextInput
          style={s.searchInput}
          placeholder="Search name or position…"
          placeholderTextColor="#9CA3AF"
          value={search}
          onChangeText={setSearch}
          autoCapitalize="none"
          autoCorrect={false}
        />
        {search.length > 0 && (
          <TouchableOpacity style={s.clearBtn} onPress={() => setSearch('')} hitSlop={8}>
            <Text style={s.clearText}>✕</Text>
          </TouchableOpacity>
        )}
      </View>
      {listLoading && <ActivityIndicator color="#4F46E5" style={{ margin: 12 }} />}
      {!listLoading && employees.length === 0 && (
        <View style={s.card}><Text style={s.muted}>No employees found</Text></View>
      )}
    </View>
  );

  return (
    <SafeAreaView style={{ flex: 1 }}>
      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <FlatList
          contentContainerStyle={s.listContent}
          data={employees}
          keyExtractor={(e) => e.id}
          ListHeaderComponent={header}
          renderItem={({ item }) => (
            <View style={[s.card, s.item]}>
              <View style={[s.avatar, { backgroundColor: avatarColor(item.id) }]}>
                <Text style={s.avatarText}>{initials(item.name)}</Text>
              </View>
              <View style={{ flex: 1 }}>
                <Text style={s.name}>{item.name}</Text>
                <Text style={s.muted}>{item.position}</Text>
                <Text style={s.salaryText}>฿{Number(item.salary).toLocaleString()}</Text>
                <View style={[s.pill, item.status === 'Active' ? s.pillActive : s.pillLeave]}>
                  <Text style={[s.pillText, { color: item.status === 'Active' ? '#15803D' : '#B45309' }]}>
                    {item.status}
                  </Text>
                </View>
                <View style={s.actions}>
                  <TouchableOpacity style={s.outline} onPress={() => toggleStatus(item.id)}>
                    <Text style={s.outlineText}>Toggle Status</Text>
                  </TouchableOpacity>
                  <TouchableOpacity style={s.danger} onPress={() => remove(item)}>
                    <Text style={s.dangerText}>Delete</Text>
                  </TouchableOpacity>
                </View>
              </View>
            </View>
          )}
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

const PRIMARY = '#4F46E5';
const shadow = Platform.select({
  android: { elevation: 3 },
  default: { shadowColor: '#1E1B4B', shadowOpacity: 0.08, shadowRadius: 12, shadowOffset: { width: 0, height: 4 } },
});

const s = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#F5F7FB', paddingTop: Platform.OS === 'android' ? 30 : 0 },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: 16 },
  listContent: { padding: 16, width: '100%', maxWidth: 720, alignSelf: 'center' },
  card: { backgroundColor: '#fff', borderRadius: 16, padding: 16, marginBottom: 16, ...shadow },
  loginCard: { width: '100%', maxWidth: 420 },
  loginTitle: { fontSize: 28, fontWeight: '800', color: '#111827', textAlign: 'center' },
  subtitle: { color: '#6B7280', textAlign: 'center', marginTop: 4, marginBottom: 20 },
  hint: { color: '#9CA3AF', fontSize: 12, textAlign: 'center', marginTop: 14 },
  headerRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 },
  title: { fontSize: 26, fontWeight: '800', color: '#111827' },
  muted: { color: '#6B7280', fontSize: 14 },
  logout: { borderWidth: 1, borderColor: PRIMARY, borderRadius: 999, paddingVertical: 6, paddingHorizontal: 14 },
  logoutText: { color: PRIMARY, fontWeight: '600' },
  statsRow: { flexDirection: 'row', gap: 12, marginBottom: 16 },
  stat: { flex: 1, backgroundColor: '#fff', borderRadius: 16, padding: 14, alignItems: 'center', ...shadow },
  statNum: { fontSize: 24, fontWeight: '800', color: PRIMARY },
  statLabel: { color: '#6B7280', fontSize: 12, marginTop: 2 },
  section: { fontSize: 18, fontWeight: '700', color: '#111827', marginBottom: 12 },
  label: { fontSize: 13, fontWeight: '600', color: '#374151', marginBottom: 6 },
  input: { borderWidth: 1.5, borderColor: '#E5E7EB', borderRadius: 12, paddingVertical: 11, paddingHorizontal: 12, marginBottom: 14, backgroundColor: '#F9FAFB', color: '#111827' },
  inputFocused: { borderColor: PRIMARY, backgroundColor: '#fff' },
  searchWrap: { flexDirection: 'row', alignItems: 'center', marginBottom: 16, backgroundColor: '#fff', borderRadius: 12, borderWidth: 1.5, borderColor: '#E5E7EB' },
  searchInput: { flex: 1, paddingVertical: 11, paddingHorizontal: 12, color: '#111827' },
  clearBtn: { paddingHorizontal: 12, paddingVertical: 8 },
  clearText: { color: '#6B7280', fontSize: 16, fontWeight: '700' },
  btn: { backgroundColor: PRIMARY, paddingVertical: 14, borderRadius: 12, alignItems: 'center', width: '100%' },
  btnDisabled: { opacity: 0.7 },
  analyze: { backgroundColor: '#7C3AED', marginBottom: 16 },
  btnText: { color: '#fff', fontWeight: '700', fontSize: 15 },
  tierCard: { borderLeftWidth: 5 },
  tier: { fontWeight: '700', marginBottom: 4 },
  bigNum: { fontSize: 28, fontWeight: '800', color: '#111827' },
  item: { flexDirection: 'row', alignItems: 'flex-start' },
  avatar: { width: 46, height: 46, borderRadius: 23, alignItems: 'center', justifyContent: 'center', marginRight: 12 },
  avatarText: { color: '#fff', fontWeight: '700', fontSize: 16 },
  name: { fontWeight: '700', fontSize: 16, color: '#111827' },
  salaryText: { fontWeight: '600', color: '#111827', marginTop: 4 },
  pill: { alignSelf: 'flex-start', borderRadius: 999, paddingVertical: 3, paddingHorizontal: 10, marginTop: 8 },
  pillActive: { backgroundColor: '#DCFCE7' },
  pillLeave: { backgroundColor: '#FEF3C7' },
  pillText: { fontSize: 12, fontWeight: '700' },
  actions: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 12 },
  outline: { borderWidth: 1, borderColor: PRIMARY, borderRadius: 999, paddingVertical: 7, paddingHorizontal: 14 },
  outlineText: { color: PRIMARY, fontWeight: '600', fontSize: 13 },
  danger: { backgroundColor: '#FEE2E2', borderRadius: 999, paddingVertical: 7, paddingHorizontal: 14 },
  dangerText: { color: '#DC2626', fontWeight: '600', fontSize: 13 },
});