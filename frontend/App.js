import React, { useState, useEffect, useCallback } from 'react';
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
      <View style={s.card}>
        <Text style={s.title}>HR Manager</Text>
        <TextInput style={s.input} placeholder="Username" autoCapitalize="none"
          value={username} onChangeText={setUsername} />
        <TextInput style={s.input} placeholder="Password" secureTextEntry
          value={password} onChangeText={setPassword} onSubmitEditing={submit} />
        <TouchableOpacity style={s.btn} onPress={submit} disabled={loading}>
          {loading ? <ActivityIndicator color="#fff" /> : <Text style={s.btnText}>Login</Text>}
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  );
}

function DashboardScreen({ token, onLogout }) {
  const api = makeApi(token, () => {
    notify('Session expired', 'Please log in again.');
    onLogout();
  });
  const [employees, setEmployees] = useState([]);
  const [listLoading, setListLoading] = useState(true);
  const [name, setName] = useState('');
  const [position, setPosition] = useState('');
  const [salary, setSalary] = useState('');
  const [clusters, setClusters] = useState(null);
  const [analyzing, setAnalyzing] = useState(false);

  const load = useCallback(async () => {
    try {
      const res = await api('/employees');
      setEmployees(await res.json());
    } catch (e) {
      if (e.message === 'unauthorized') return;
      notify('Network error', 'Failed to load employees.');
    } finally {
      setListLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const addEmployee = async () => {
    const sal = Number(salary);
    if (!name.trim() || !position.trim() || !salary.trim()) {
      return notify('Validation', 'Name, position and salary are required.');
    }
    if (!Number.isFinite(sal) || sal < 0) {
      return notify('Validation', 'Salary must be a valid number.');
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

  const header = (
    <View>
      <View style={s.row}>
        <Text style={s.title}>Dashboard</Text>
        <TouchableOpacity onPress={onLogout}><Text style={s.link}>Logout</Text></TouchableOpacity>
      </View>

      <View style={s.card}>
        <Text style={s.section}>Add Employee</Text>
        <TextInput style={s.input} placeholder="Name" value={name} onChangeText={setName} />
        <TextInput style={s.input} placeholder="Position" value={position} onChangeText={setPosition} />
        <TextInput style={s.input} placeholder="Salary" keyboardType="numeric"
          value={salary} onChangeText={setSalary} />
        <TouchableOpacity style={s.btn} onPress={addEmployee}>
          <Text style={s.btnText}>Add Employee</Text>
        </TouchableOpacity>
      </View>

      <TouchableOpacity style={[s.btn, s.analyze]} onPress={analyze} disabled={analyzing}>
        <Text style={s.btnText}>Analyze Salary Structure</Text>
      </TouchableOpacity>
      {analyzing && <ActivityIndicator size="large" style={{ marginVertical: 12 }} />}
      {clusters && !analyzing && (
        <View style={s.cards}>
          {clusters.map((c) => (
            <View key={c.group} style={s.summary}>
              <Text style={s.tier}>{c.group}</Text>
              <Text>Employees: {c.count}</Text>
              <Text>Avg salary: {Math.round(c.centroid).toLocaleString()}</Text>
            </View>
          ))}
        </View>
      )}

      <Text style={s.section}>Employees ({employees.length})</Text>
      {listLoading && <ActivityIndicator style={{ margin: 12 }} />}
    </View>
  );

  return (
    <SafeAreaView style={{ flex: 1 }}>
      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <FlatList
          contentContainerStyle={{ padding: 16 }}
          data={employees}
          keyExtractor={(e) => e.id}
          ListHeaderComponent={header}
          renderItem={({ item }) => (
            <View style={s.item}>
              <View style={{ flex: 1 }}>
                <Text style={s.name}>{item.name}</Text>
                <Text>{item.position}</Text>
                <Text>Salary: {Number(item.salary).toLocaleString()}</Text>
                <Text style={item.status === 'Active' ? s.active : s.leave}>{item.status}</Text>
              </View>
              <View>
                <TouchableOpacity style={s.small} onPress={() => toggleStatus(item.id)}>
                  <Text style={s.btnText}>Toggle Status</Text>
                </TouchableOpacity>
                <TouchableOpacity style={[s.small, s.danger]} onPress={() => remove(item)}>
                  <Text style={s.btnText}>Delete</Text>
                </TouchableOpacity>
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
      <StatusBar style="auto" />
      {token ? <DashboardScreen token={token} onLogout={() => setToken(null)} /> : <LoginScreen onLogin={setToken} />}
    </View>
  );
}

const s = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#f2f4f8', paddingTop: Platform.OS === 'android' ? 30 : 0 },
  center: { flex: 1, justifyContent: 'center', padding: 16 },
  card: { backgroundColor: '#fff', borderRadius: 10, padding: 16, marginBottom: 12 },
  title: { fontSize: 24, fontWeight: '700', marginBottom: 12 },
  section: { fontSize: 18, fontWeight: '600', marginVertical: 8 },
  input: { borderWidth: 1, borderColor: '#ccd', borderRadius: 8, padding: 10, marginBottom: 10, backgroundColor: '#fff' },
  btn: { backgroundColor: '#2563eb', padding: 12, borderRadius: 8, alignItems: 'center' },
  analyze: { backgroundColor: '#7c3aed', marginBottom: 12 },
  btnText: { color: '#fff', fontWeight: '600' },
  link: { color: '#2563eb', fontSize: 16 },
  row: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  item: { flexDirection: 'row', backgroundColor: '#fff', borderRadius: 10, padding: 12, marginBottom: 10 },
  name: { fontWeight: '700', fontSize: 16 },
  active: { color: '#16a34a', fontWeight: '600' },
  leave: { color: '#d97706', fontWeight: '600' },
  small: { backgroundColor: '#2563eb', paddingVertical: 8, paddingHorizontal: 10, borderRadius: 6, marginBottom: 6, alignItems: 'center' },
  danger: { backgroundColor: '#dc2626' },
  cards: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 8 },
  summary: { flexGrow: 1, minWidth: 100, backgroundColor: '#fff', borderRadius: 10, padding: 12, borderLeftWidth: 4, borderLeftColor: '#7c3aed' },
  tier: { fontWeight: '700', marginBottom: 4 },
});
