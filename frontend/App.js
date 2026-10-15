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

const theme = {
  colors: {
    primary: '#4F46E5', primaryDark: '#4338CA', violet: '#7C3AED', violetDark: '#6D28D9',
    bg: '#F4F6FB', card: '#FFFFFF', text: '#0F172A', muted: '#64748B', border: '#E2E8F0',
    success: '#10B981', warning: '#F59E0B', danger: '#EF4444',
    successBg: '#D1FAE5', warningBg: '#FEF3C7', dangerBg: '#FEE2E2', primaryBg: '#EEF2FF',
  },
  radius: { sm: 10, md: 12, lg: 20, xl: 28, pill: 999 },
  space: { xs: 4, sm: 8, md: 16, lg: 24, xl: 32 },
  shadow: Platform.select({
    android: { elevation: 4 },
    default: { shadowColor: '#312E81', shadowOpacity: 0.1, shadowRadius: 16, shadowOffset: { width: 0, height: 6 } },
  }),
  shadowBig: Platform.select({
    android: { elevation: 12 },
    default: { shadowColor: '#1E1B4B', shadowOpacity: 0.3, shadowRadius: 32, shadowOffset: { width: 0, height: 16 } },
  }),
};
const C = theme.colors;

// Labeled text input with optional left icon / right element and a focus highlight (styling only).
function Field({ label, icon, right, style, ...props }) {
  const [focused, setFocused] = useState(false);
  return (
    <View style={{ marginBottom: theme.space.md }}>
      <Text style={s.label}>{label}</Text>
      <View style={[s.inputWrap, focused && s.inputFocused]}>
        {icon ? <Text style={s.inputIcon}>{icon}</Text> : null}
        <TextInput
          placeholderTextColor="#94A3B8"
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

  const [showPw, setShowPw] = useState(false);

  return (
    <SafeAreaView style={s.loginRoot}>
      <View style={[s.blob, { width: 360, height: 360, top: -120, left: -100, backgroundColor: 'rgba(255,255,255,0.12)' }]} />
      <View style={[s.blob, { width: 280, height: 280, bottom: -90, right: -70, backgroundColor: 'rgba(167,139,250,0.35)' }]} />
      <View style={[s.blob, { width: 160, height: 160, top: '55%', left: -60, backgroundColor: 'rgba(255,255,255,0.08)' }]} />
      <View style={s.center}>
        <View style={s.loginCard}>
          <View style={s.logo}><Text style={{ fontSize: 34 }}>👥</Text></View>
          <Text style={s.loginTitle}>HR Manager</Text>
          <Text style={s.subtitle}>Employee & Salary Analytics</Text>
          <Field label="Username" icon="👤" placeholder="Username" autoCapitalize="none"
            value={username} onChangeText={setUsername} />
          <Field label="Password" icon="🔒" placeholder="Password" secureTextEntry={!showPw}
            value={password} onChangeText={setPassword} onSubmitEditing={submit}
            right={
              <TouchableOpacity onPress={() => setShowPw((v) => !v)} hitSlop={8} style={s.eye}>
                <Text style={{ fontSize: 18, opacity: showPw ? 1 : 0.5 }}>👁</Text>
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

  const total = allEmployees.length;
  const activeCount = allEmployees.filter((e) => e.status === 'Active').length;
  const leaveCount = allEmployees.filter((e) => e.status === 'On Leave').length;
  const initials = (n) =>
    String(n).trim().split(/\s+/).slice(0, 2).map((w) => (w[0] || '').toUpperCase()).join('');
  const tierColors = [C.success, C.primary, C.warning];
  const avatarColors = ['#4F46E5', '#0EA5E9', '#10B981', '#F59E0B', '#EC4899', '#7C3AED', '#14B8A6', '#F97316'];
  const avatarColor = (name) => {
    let h = 0;
    for (const ch of String(name)) h = (h * 31 + ch.charCodeAt(0)) % 100003;
    return avatarColors[h % avatarColors.length];
  };
  const clusterTotal = clusters ? clusters.reduce((sum, c) => sum + c.count, 0) : 0;
  const today = new Date().toLocaleDateString(undefined, { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' });
  const [addOpen, setAddOpen] = useState(true);

  const header = (
    <View>
      <View style={s.banner}>
        <View style={s.page}>
          <View style={s.headerRow}>
            <View style={{ flex: 1 }}>
              <Text style={s.hello}>Hello, Admin 👋</Text>
              <Text style={s.helloSub}>{today}</Text>
            </View>
            <TouchableOpacity style={s.logout} onPress={onLogout}>
              <Text style={s.logoutText}>Logout</Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>

      <View style={[s.page, s.pagePad]}>
        <View style={s.statsRow}>
          {[
            { icon: '👥', label: 'Total', n: total, color: C.primary, bg: C.primaryBg },
            { icon: '✅', label: 'Active', n: activeCount, color: C.success, bg: C.successBg },
            { icon: '🌴', label: 'On Leave', n: leaveCount, color: C.warning, bg: C.warningBg },
          ].map((x) => (
            <View key={x.label} style={s.stat}>
              <View style={[s.statIcon, { backgroundColor: x.bg }]}><Text style={{ fontSize: 18 }}>{x.icon}</Text></View>
              <Text style={[s.statNum, { color: x.color }]}>{x.n}</Text>
              <Text style={s.statLabel}>{x.label}</Text>
            </View>
          ))}
        </View>

        <View style={s.card}>
          <TouchableOpacity style={s.collapseRow} onPress={() => setAddOpen((v) => !v)} activeOpacity={0.7}>
            <Text style={s.cardTitle}>➕ Add Employee</Text>
            <Text style={s.chev}>{addOpen ? '▲' : '▼'}</Text>
          </TouchableOpacity>
          {addOpen && (
            <View style={{ marginTop: theme.space.md }}>
              <Field label="Name" placeholder="Full name" value={name} onChangeText={setName} />
              <Field label="Position" placeholder="Job title" value={position} onChangeText={setPosition} />
              <Field label="Salary" placeholder="e.g. 45000" keyboardType="numeric"
                value={salary} onChangeText={setSalary} />
              <TouchableOpacity style={s.btn} onPress={addEmployee}>
                <Text style={s.btnText}>Add Employee</Text>
              </TouchableOpacity>
            </View>
          )}
        </View>

        <Text style={s.sectionTitle}>📊 Salary Structure</Text>
        <TouchableOpacity style={[s.btn, s.analyze, analyzing && s.btnDisabled]} onPress={analyze} disabled={analyzing}>
          {analyzing ? <ActivityIndicator color="#fff" /> : <Text style={s.btnText}>Analyze Salary Structure</Text>}
        </TouchableOpacity>
        {clusters && !analyzing && clusters.length === 0 && (
          <View style={[s.card, s.empty]}>
            <Text style={s.emptyEmoji}>📭</Text>
            <Text style={s.emptyText}>No data</Text>
          </View>
        )}
        {clusters && !analyzing && clusters.length > 0 && (
          <View>
            {clusters.map((c, i) => {
              const color = tierColors[i % 3];
              const pct = clusterTotal ? (c.count / clusterTotal) * 100 : 0;
              return (
                <View key={c.group} style={[s.card, s.tierCard, { borderLeftColor: color }]}>
                  <View style={s.tierTop}>
                    <Text style={[s.tier, { color }]}>{c.group}</Text>
                    <Text style={s.muted}>{c.count} employees</Text>
                  </View>
                  <Text style={s.bigNum}>฿{Math.round(c.centroid).toLocaleString()}</Text>
                  <Text style={s.small}>average salary</Text>
                  <View style={s.barTrack}>
                    <View style={[s.barFill, { width: `${pct}%`, backgroundColor: color }]} />
                  </View>
                </View>
              );
            })}
          </View>
        )}

        <Text style={[s.sectionTitle, { marginTop: theme.space.sm }]}>Employees ({employees.length})</Text>
        <View style={s.searchWrap}>
          <Text style={s.searchIcon}>🔍</Text>
          <TextInput
            style={s.searchInput}
            placeholder="Search name or position…"
            placeholderTextColor="#94A3B8"
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
        {listLoading && <ActivityIndicator color={C.primary} style={{ margin: 12 }} />}
        {!listLoading && employees.length === 0 && (
          <View style={[s.card, s.empty]}>
            <Text style={s.emptyEmoji}>🔎</Text>
            <Text style={s.emptyText}>No employees found</Text>
          </View>
        )}
      </View>
    </View>
  );

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: C.primary }}>
      <KeyboardAvoidingView style={{ flex: 1, backgroundColor: C.bg }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <FlatList
          contentContainerStyle={{ paddingBottom: theme.space.xl }}
          data={employees}
          keyExtractor={(e) => e.id}
          ListHeaderComponent={header}
          renderItem={({ item }) => (
            <View style={[s.page, s.pagePad]}>
              <View style={[s.card, s.item]}>
                <View style={s.itemTop}>
                  <View style={[s.avatar, { backgroundColor: avatarColor(item.name) }]}>
                    <Text style={s.avatarText}>{initials(item.name)}</Text>
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={s.name}>{item.name}</Text>
                    <Text style={s.muted}>{item.position}</Text>
                  </View>
                  <View style={s.salaryCol}>
                    <Text style={s.salaryText}>฿{Number(item.salary).toLocaleString()}</Text>
                    <View style={[s.pill, item.status === 'Active' ? s.pillActive : s.pillLeave]}>
                      <Text style={[s.pillText, { color: item.status === 'Active' ? '#047857' : '#B45309' }]}>
                        {item.status}
                      </Text>
                    </View>
                  </View>
                </View>
                <View style={s.divider} />
                <View style={s.actions}>
                  <TouchableOpacity style={s.outline} onPress={() => toggleStatus(item.id)}>
                    <Text style={s.outlineText}>⇄ Toggle</Text>
                  </TouchableOpacity>
                  <TouchableOpacity style={s.danger} onPress={() => remove(item)}>
                    <Text style={s.dangerText}>🗑 Delete</Text>
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
      <StatusBar style={token ? 'light' : 'light'} />
      {token ? <DashboardScreen token={token} onLogout={() => setToken(null)} /> : <LoginScreen onLogin={setToken} />}
    </View>
  );
}

const s = StyleSheet.create({
  root: { flex: 1, backgroundColor: C.bg, paddingTop: Platform.OS === 'android' ? 30 : 0 },
  loginRoot: { flex: 1, backgroundColor: C.primary, overflow: 'hidden' },
  blob: { position: 'absolute', borderRadius: 999 },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: theme.space.md },
  page: { width: '100%', maxWidth: 720, alignSelf: 'center' },
  pagePad: { paddingHorizontal: theme.space.md },
  card: { backgroundColor: C.card, borderRadius: theme.radius.lg, padding: theme.space.md, marginBottom: theme.space.md, ...theme.shadow },
  cardTitle: { fontSize: 16, fontWeight: '700', color: C.text },
  loginCard: { width: '100%', maxWidth: 420, backgroundColor: C.card, borderRadius: theme.radius.xl, padding: theme.space.lg, ...theme.shadowBig },
  logo: { width: 72, height: 72, borderRadius: 36, backgroundColor: C.primaryBg, alignItems: 'center', justifyContent: 'center', alignSelf: 'center', marginBottom: theme.space.md },
  loginTitle: { fontSize: 28, fontWeight: '800', color: C.text, textAlign: 'center' },
  subtitle: { fontSize: 14, color: C.muted, textAlign: 'center', marginTop: 4, marginBottom: theme.space.lg },
  hint: { color: '#94A3B8', fontSize: 12, textAlign: 'center', marginTop: 14 },
  banner: { backgroundColor: C.primary, paddingTop: theme.space.lg, paddingBottom: 72, paddingHorizontal: theme.space.md, borderBottomLeftRadius: theme.radius.xl, borderBottomRightRadius: theme.radius.xl },
  headerRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  hello: { fontSize: 28, fontWeight: '800', color: '#fff' },
  helloSub: { fontSize: 14, color: 'rgba(255,255,255,0.75)', marginTop: 4 },
  logout: { backgroundColor: 'rgba(255,255,255,0.2)', borderRadius: theme.radius.pill, paddingVertical: 8, paddingHorizontal: 16, marginLeft: 12 },
  logoutText: { color: '#fff', fontWeight: '600', fontSize: 14 },
  statsRow: { flexDirection: 'row', gap: 12, marginTop: -48, marginBottom: theme.space.md },
  stat: { flex: 1, backgroundColor: C.card, borderRadius: theme.radius.lg, padding: 14, alignItems: 'center', ...theme.shadow },
  statIcon: { width: 40, height: 40, borderRadius: 20, alignItems: 'center', justifyContent: 'center', marginBottom: 8 },
  statNum: { fontSize: 28, fontWeight: '800' },
  statLabel: { color: C.muted, fontSize: 12, fontWeight: '600', marginTop: 2 },
  sectionTitle: { fontSize: 20, fontWeight: '700', color: C.text, marginBottom: 12 },
  muted: { color: C.muted, fontSize: 14 },
  small: { color: C.muted, fontSize: 12 },
  collapseRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  chev: { color: C.muted, fontSize: 12 },
  label: { fontSize: 12, fontWeight: '600', color: '#334155', marginBottom: 6 },
  inputWrap: { flexDirection: 'row', alignItems: 'center', borderWidth: 1.5, borderColor: C.border, borderRadius: theme.radius.md, backgroundColor: '#F8FAFC', paddingHorizontal: 12 },
  inputFocused: { borderColor: C.primary, backgroundColor: '#fff' },
  inputIcon: { fontSize: 16, marginRight: 8 },
  input: { flex: 1, paddingVertical: 12, fontSize: 14, color: C.text, outlineStyle: 'none' },
  eye: { paddingLeft: 8 },
  btn: { backgroundColor: C.primary, paddingVertical: 14, borderRadius: theme.radius.md, alignItems: 'center', width: '100%' },
  btnDisabled: { opacity: 0.7 },
  analyze: { backgroundColor: C.violet, borderWidth: 1.5, borderColor: C.violetDark, marginBottom: theme.space.md },
  btnText: { color: '#fff', fontWeight: '700', fontSize: 16, letterSpacing: 0.5 },
  tierCard: { borderLeftWidth: 6 },
  tierTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 },
  tier: { fontWeight: '700', fontSize: 16 },
  bigNum: { fontSize: 28, fontWeight: '800', color: C.text },
  barTrack: { height: 8, borderRadius: 4, backgroundColor: '#E2E8F0', marginTop: 12, overflow: 'hidden' },
  barFill: { height: 8, borderRadius: 4 },
  searchWrap: { flexDirection: 'row', alignItems: 'center', backgroundColor: C.card, borderRadius: theme.radius.pill, paddingHorizontal: 16, marginBottom: theme.space.md, ...theme.shadow },
  searchIcon: { fontSize: 15, marginRight: 8 },
  searchInput: { flex: 1, paddingVertical: 13, fontSize: 14, color: C.text, outlineStyle: 'none' },
  clearBtn: { width: 26, height: 26, borderRadius: 13, backgroundColor: '#F1F5F9', alignItems: 'center', justifyContent: 'center' },
  clearText: { color: C.muted, fontSize: 12, fontWeight: '700' },
  empty: { alignItems: 'center', paddingVertical: theme.space.lg },
  emptyEmoji: { fontSize: 34, marginBottom: 6 },
  emptyText: { color: C.muted, fontSize: 14 },
  item: { padding: 18 },
  itemTop: { flexDirection: 'row', alignItems: 'center' },
  avatar: { width: 48, height: 48, borderRadius: 24, alignItems: 'center', justifyContent: 'center', marginRight: 14 },
  avatarText: { color: '#fff', fontWeight: '700', fontSize: 16 },
  name: { fontWeight: '700', fontSize: 16, color: C.text, marginBottom: 2 },
  salaryCol: { alignItems: 'flex-end', marginLeft: 8 },
  salaryText: { fontWeight: '800', fontSize: 16, color: C.text },
  pill: { borderRadius: theme.radius.pill, paddingVertical: 3, paddingHorizontal: 10, marginTop: 6 },
  pillActive: { backgroundColor: C.successBg },
  pillLeave: { backgroundColor: C.warningBg },
  pillText: { fontSize: 12, fontWeight: '700' },
  divider: { height: 1, backgroundColor: '#F1F5F9', marginVertical: 14 },
  actions: { flexDirection: 'row', gap: 8 },
  outline: { backgroundColor: C.primaryBg, borderRadius: theme.radius.pill, paddingVertical: 8, paddingHorizontal: 14 },
  outlineText: { color: C.primary, fontWeight: '600', fontSize: 12 },
  danger: { backgroundColor: C.dangerBg, borderRadius: theme.radius.pill, paddingVertical: 8, paddingHorizontal: 14 },
  dangerText: { color: C.danger, fontWeight: '600', fontSize: 12 },
});
