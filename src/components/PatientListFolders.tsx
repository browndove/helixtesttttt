'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import Sidebar from '@/components/Sidebar';
import TopBar from '@/components/TopBar';
import navSections from '@/components/navSections';

type Folder = {
    id: string;
    name: string;
    description?: string;
    patients?: unknown[];
    patient_count?: number;
};

function extractFolderList(raw: unknown): Folder[] {
    const list = Array.isArray(raw)
        ? raw
        : (raw && typeof raw === 'object'
            ? ((raw as { items?: unknown; data?: unknown; folders?: unknown; patient_folders?: unknown }).items
                || (raw as { items?: unknown; data?: unknown; folders?: unknown; patient_folders?: unknown }).data
                || (raw as { items?: unknown; data?: unknown; folders?: unknown; patient_folders?: unknown }).folders
                || (raw as { items?: unknown; data?: unknown; folders?: unknown; patient_folders?: unknown }).patient_folders)
            : []);
    if (!Array.isArray(list)) return [];
    return list
        .map((x) => {
            if (!x || typeof x !== 'object') return null;
            const r = x as Record<string, unknown>;
            const id = String(r.id || '').trim();
            if (!id) return null;
            return {
                id,
                name: String(r.name || 'Untitled Folder').trim(),
                description: String(r.description || '').trim(),
                patients: Array.isArray(r.patients) ? r.patients : [],
                patient_count: typeof r.patient_count === 'number' ? r.patient_count : undefined,
            } as Folder;
        })
        .filter((f): f is Folder => Boolean(f));
}

export default function PatientListFolders() {
    const [folders, setFolders] = useState<Folder[]>([]);
    const [selectedId, setSelectedId] = useState<string | null>(null);
    const [newName, setNewName] = useState('');
    const [newDesc, setNewDesc] = useState('');
    const [renaming, setRenaming] = useState(false);
    const [renameValue, setRenameValue] = useState('');
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [toast, setToast] = useState<string | null>(null);

    const showToast = useCallback((msg: string) => {
        setToast(msg);
        setTimeout(() => setToast(null), 2200);
    }, []);

    const selected = useMemo(
        () => folders.find(f => f.id === selectedId) || null,
        [folders, selectedId]
    );

    const fetchFolders = useCallback(async () => {
        setLoading(true);
        try {
            const res = await fetch('/api/proxy/patient-folders');
            if (!res.ok) {
                showToast('Failed to load patient folders');
                setLoading(false);
                return;
            }
            const data = await res.json();
            const parsed = extractFolderList(data);
            setFolders(parsed);
            if (parsed.length > 0 && !selectedId) setSelectedId(parsed[0].id);
        } catch {
            showToast('Failed to load patient folders');
        }
        setLoading(false);
    }, [selectedId, showToast]);

    useEffect(() => { fetchFolders(); }, [fetchFolders]);

    const createFolder = async () => {
        if (!newName.trim()) {
            showToast('Folder name is required');
            return;
        }
        setSaving(true);
        try {
            const res = await fetch('/api/proxy/patient-folders', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    name: newName.trim(),
                    description: newDesc.trim() || undefined,
                }),
            });
            if (!res.ok) {
                showToast('Failed to create folder');
                setSaving(false);
                return;
            }
            const createdRaw = await res.json();
            const created = extractFolderList([createdRaw])[0];
            if (created) {
                setFolders(prev => [created, ...prev]);
                setSelectedId(created.id);
            }
            setNewName('');
            setNewDesc('');
            showToast('Folder created');
        } catch {
            showToast('Failed to create folder');
        }
        setSaving(false);
    };

    const renameFolder = async () => {
        if (!selected || !renameValue.trim()) return;
        setSaving(true);
        try {
            const res = await fetch(`/api/proxy/patient-folders/${selected.id}`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ name: renameValue.trim() }),
            });
            if (!res.ok) {
                showToast('Failed to rename folder');
                setSaving(false);
                return;
            }
            const updatedRaw = await res.json();
            const updated = extractFolderList([updatedRaw])[0];
            setFolders(prev => prev.map(f => f.id === selected.id ? { ...f, ...(updated || { name: renameValue.trim() }) } : f));
            setRenaming(false);
            showToast('Folder renamed');
        } catch {
            showToast('Failed to rename folder');
        }
        setSaving(false);
    };

    const deleteFolder = async () => {
        if (!selected) return;
        setSaving(true);
        try {
            const res = await fetch(`/api/proxy/patient-folders/${selected.id}`, { method: 'DELETE' });
            if (!res.ok) {
                showToast('Failed to delete folder');
                setSaving(false);
                return;
            }
            const next = folders.filter(f => f.id !== selected.id);
            setFolders(next);
            setSelectedId(next[0]?.id || null);
            setRenaming(false);
            showToast('Folder deleted');
        } catch {
            showToast('Failed to delete folder');
        }
        setSaving(false);
    };

    return (
        <div className="app-shell">
            <Sidebar sections={navSections} />
            <div className="app-main">
                <TopBar title="Patient List" subtitle="Patient Categories" />
                {toast && (
                    <div className="toast-enter" style={{ position: 'fixed', top: 20, right: 20, zIndex: 999, background: 'var(--surface-card)', border: '1px solid var(--border-default)', borderRadius: 'var(--radius-md)', padding: '10px 18px', fontSize: 13, fontWeight: 600, color: 'var(--text-primary)', boxShadow: '0 4px 12px rgba(0,0,0,0.1)', display: 'flex', alignItems: 'center', gap: 8 }}>
                        <span className="material-icons-round" style={{ fontSize: 16, color: 'var(--success)' }}>check_circle</span>
                        {toast}
                    </div>
                )}
                <main style={{ flex: 1, overflow: 'auto', padding: '24px 28px', background: 'var(--bg-900)' }}>
                    <div className="card fade-in" style={{ padding: 20, marginBottom: 16 }}>
                        <h3 style={{ margin: 0, fontSize: 16 }}>Patient List Folders</h3>
                        <p style={{ margin: '6px 0 0', fontSize: 12, color: 'var(--text-muted)' }}>
                            Use this area to categorize patient records into meaningful folders for quick access.
                        </p>
                    </div>

                    <div style={{ display: 'grid', gridTemplateColumns: selected ? '1fr 320px' : '1fr', gap: 14 }}>
                        <div className="card fade-in" style={{ padding: 16 }}>
                            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr auto', gap: 8, marginBottom: 12 }}>
                                <input className="input" value={newName} onChange={e => setNewName(e.target.value)} placeholder="New folder name" />
                                <input className="input" value={newDesc} onChange={e => setNewDesc(e.target.value)} placeholder="Description (optional)" />
                                <button className="btn btn-primary btn-sm" onClick={createFolder} disabled={saving || !newName.trim()}>
                                    <span className="material-icons-round" style={{ fontSize: 14 }}>create_new_folder</span>Create
                                </button>
                            </div>

                            {loading ? (
                                <div style={{ padding: 20, fontSize: 12, color: 'var(--text-muted)' }}>Loading folders...</div>
                            ) : folders.length === 0 ? (
                                <div style={{ padding: 20, fontSize: 12, color: 'var(--text-muted)' }}>No patient folders yet.</div>
                            ) : (
                                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(230px, 1fr))', gap: 10 }}>
                                    {folders.map(folder => (
                                        <button
                                            key={folder.id}
                                            type="button"
                                            onClick={() => { setSelectedId(folder.id); setRenaming(false); setRenameValue(folder.name); }}
                                            className="card"
                                            style={{
                                                padding: 14,
                                                border: selectedId === folder.id ? '1px solid var(--helix-primary)' : '1px solid var(--border-subtle)',
                                                background: selectedId === folder.id ? 'rgba(99,102,241,0.06)' : 'var(--surface-card)',
                                                textAlign: 'left',
                                                cursor: 'pointer',
                                            }}
                                        >
                                            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 }}>
                                                <span className="material-icons-round" style={{ fontSize: 18, color: 'var(--helix-primary)' }}>folder</span>
                                                <h4 style={{ margin: 0, fontSize: 13.5 }}>{folder.name}</h4>
                                            </div>
                                            <p style={{ margin: 0, fontSize: 11.5, color: 'var(--text-muted)', lineHeight: 1.45 }}>
                                                {folder.description || 'No description'}
                                            </p>
                                            <div style={{ marginTop: 8, fontSize: 10.5, color: 'var(--text-disabled)' }}>
                                                {folder.patient_count ?? folder.patients?.length ?? 0} patients
                                            </div>
                                        </button>
                                    ))}
                                </div>
                            )}
                        </div>

                        {selected && (
                            <div className="card fade-in" style={{ padding: 16, display: 'flex', flexDirection: 'column', gap: 10 }}>
                                <h4 style={{ margin: 0, fontSize: 14 }}>Folder Details</h4>
                                {renaming ? (
                                    <>
                                        <input className="input" value={renameValue} onChange={e => setRenameValue(e.target.value)} />
                                        <div style={{ display: 'flex', gap: 8 }}>
                                            <button className="btn btn-primary btn-sm" onClick={renameFolder} disabled={saving || !renameValue.trim()}>Save</button>
                                            <button className="btn btn-secondary btn-sm" onClick={() => setRenaming(false)}>Cancel</button>
                                        </div>
                                    </>
                                ) : (
                                    <>
                                        <div style={{ fontSize: 13, fontWeight: 700 }}>{selected.name}</div>
                                        <div style={{ fontSize: 11.5, color: 'var(--text-muted)' }}>{selected.description || 'No description'}</div>
                                        <div style={{ fontSize: 11, color: 'var(--text-disabled)' }}>
                                            Members: {selected.patient_count ?? selected.patients?.length ?? 0}
                                        </div>
                                        <div style={{ display: 'flex', gap: 8 }}>
                                            <button className="btn btn-secondary btn-sm" onClick={() => { setRenaming(true); setRenameValue(selected.name); }}>
                                                <span className="material-icons-round" style={{ fontSize: 14 }}>edit</span>Rename
                                            </button>
                                            <button className="btn btn-danger btn-sm" onClick={deleteFolder} disabled={saving}>
                                                <span className="material-icons-round" style={{ fontSize: 14 }}>delete</span>Delete
                                            </button>
                                        </div>
                                    </>
                                )}
                            </div>
                        )}
                    </div>
                </main>
            </div>
        </div>
    );
}

