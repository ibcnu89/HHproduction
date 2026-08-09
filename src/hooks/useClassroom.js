/**
 * Classroom API hooks
 */

import { useState, useEffect, useCallback } from 'react';

const API_BASE = '/api/classroom';

async function apiFetch(endpoint, options = {}) {
  const res = await fetch(`${API_BASE}${endpoint}`, {
    credentials: 'include',
    headers: { 'Content-Type': 'application/json', ...options.headers },
    ...options,
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || 'Request failed');
  return data;
}

export function useClassroomStatus() {
  const [status, setStatus] = useState({ connected: false, loading: true, error: null });

  const fetchStatus = useCallback(async () => {
    try {
      const data = await apiFetch('/status');
      setStatus({ ...data, loading: false });
    } catch (err) {
      setStatus({ connected: false, loading: false, error: err.message });
    }
  }, []);

  useEffect(() => { fetchStatus(); }, [fetchStatus]);

  return { status, refetch: fetchStatus };
}

export function useClassroomConnect() {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const connect = useCallback(async (redirect = '/classroom') => {
    setLoading(true); setError(null);
    try {
      const { authUrl } = await apiFetch('/connect', { method: 'POST', body: JSON.stringify({ redirect }) });
      window.location.href = authUrl;
    } catch (err) {
      setError(err.message);
      setLoading(false);
    }
  }, []);

  return { connect, loading, error };
}

export function useClassroomDisconnect() {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const disconnect = useCallback(async () => {
    setLoading(true); setError(null);
    try {
      await apiFetch('/disconnect', { method: 'DELETE' });
      return true;
    } catch (err) {
      setError(err.message);
      return false;
    } finally {
      setLoading(false);
    }
  }, []);

  return { disconnect, loading, error };
}

export function useClassroomCourses() {
  const [courses, setCourses] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const fetchCourses = useCallback(async () => {
    setLoading(true); setError(null);
    try {
      const { courses: data } = await apiFetch('/courses');
      setCourses(data);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchCourses(); }, [fetchCourses]);

  return { courses, loading, error, refetch: fetchCourses };
}

export function useClassroomAssignments(courseId) {
  const [assignments, setAssignments] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const fetchAssignments = useCallback(async () => {
    if (!courseId) return;
    setLoading(true); setError(null);
    try {
      const { assignments: data } = await apiFetch(`/courses/${courseId}/assignments`);
      setAssignments(data);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, [courseId]);

  useEffect(() => { fetchAssignments(); }, [fetchAssignments]);

  return { assignments, loading, error, refetch: fetchAssignments };
}

export function useClassroomSubmissions(assignmentId) {
  const [submissions, setSubmissions] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const fetchSubmissions = useCallback(async () => {
    if (!assignmentId) return;
    setLoading(true); setError(null);
    try {
      const { submissions: data } = await apiFetch(`/assignments/${assignmentId}/submissions`);
      setSubmissions(data);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, [assignmentId]);

  useEffect(() => { fetchSubmissions(); }, [fetchSubmissions]);

  return { submissions, loading, error, refetch: fetchSubmissions };
}

export function useClassroomSync() {
  const [result, setResult] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const sync = useCallback(async () => {
    setLoading(true); setError(null); setResult(null);
    try {
      const data = await apiFetch('/sync', { method: 'POST' });
      setResult(data);
      return data;
    } catch (err) {
      setError(err.message);
      return null;
    } finally {
      setLoading(false);
    }
  }, []);

  return { sync, loading, error, result };
}

export function useGradePush() {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const pushGrade = useCallback(async (submissionId, gradingResult) => {
    setLoading(true); setError(null);
    try {
      const data = await apiFetch(`/submissions/${submissionId}/grade`, {
        method: 'POST',
        body: JSON.stringify({ gradingResult }),
      });
      return data;
    } catch (err) {
      setError(err.message);
      return null;
    } finally {
      setLoading(false);
    }
  }, []);

  return { pushGrade, loading, error };
}

export function useClassroomSyncLog() {
  const [logs, setLogs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const fetchLogs = useCallback(async () => {
    setLoading(true); setError(null);
    try {
      const { logs: data } = await apiFetch('/sync-log');
      setLogs(data);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchLogs(); }, [fetchLogs]);

  return { logs, loading, error, refetch: fetchLogs };
}