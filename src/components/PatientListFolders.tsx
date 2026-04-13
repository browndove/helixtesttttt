'use client';

import { useCallback, useEffect, useState } from 'react';
import TopBar from '@/components/TopBar';

type Folder = {
    id: string;
    name: string;
    description: string;
    patientCount: number;
    createdAt: string;
};

function parseFolder(rec: unknown, idx = 0): Folder | null {
    if (!rec || typeof rec !== 'object') return null;
    const r = rec as Record<string, unknown>;
    const patientsRaw = Array.isArray(r.patients) ? r.patients : [];
    return {
        id: String(r.id || `f-${idx}`),
        name: String(r.name || 'Unnamed Folder'),
        description: String(r.description || ''),
        patientCount: Number(r.patient_count ?? patientsRaw.length ?? 0),
        createdAt: String(r.created_at || '').slice(0, 10),
    };
}

function parseFolders(raw: unknown): Folder[] {
    const list = Array.isArray(raw)
        ? raw
        : (raw && typeof raw === 'object'
            ? ((raw as { items?: unknown; data?: unknown; folders?: unknown }).items
                || (raw as { items?: unknown; data?: unknown; folders?: unknown }).data
                || (raw as { items?: unknown; data?: unknown; folders?: unknown }).folders)
            : []);
    if (!Array.isArray(list)) return [];

    return list
        .map((f: unknown, idx) => parseFolder(f, idx))
        .filter((f): f is Folder => Boolean(f));
}

export default function PatientListFolders() {
    const [folders, setFolders] = useState<Folder[]>([]);
    const [loading, setLoading] = useState(true);
    const [selectedFolderId, setSelectedFolderId] = useState<string | null>(null);
    const [search, setSearch] = useState('');
    const [toast, setToast] = useState<string | null>(null);

    const [showCreate, setShowCreate] = useState(false);
    const [newName, setNewName] = useState('');
    const [newDesc, setNewDesc] = useState('');

    const [editingFolder, setEditingFolder] = useState(false);
    const [editName, setEditName] = useState('');
    const [editDesc, setEditDesc] = useState('');

    const showToast = (msg: string) => { setToast(msg); setTimeout(() => setToast(null), 2500); };

    const fetchData = useCallback(async () => {
        try {
            const folderRes = await fetch('/api/proxy/patient-folders?visibility=public');
            if (folderRes.ok) {
                const folderData = parseFolders(await folderRes.json());
                setFolders(folderData);
            }
        } catch {
            showToast('Failed to load patient folders');
        }
        setLoading(false);
    }, []);

    useEffect(() => { fetchData(); }, [fetchData]);

    const selectedFolder = folders.find(f => f.id === selectedFolderId) || null;

    useEffect(() => {
        if (!selectedFolderId) return;
        let cancelled = false;
        (async () => {
            try {
                const res = await fetch(`/api/proxy/patient-folders/${selectedFolderId}`);
                if (!res.ok || cancelled) return;
                const data = await res.json();
                const parsed = parseFolder(data, 0);
                if (!parsed || cancelled) return;
                setFolders(prev => prev.map(f =>
                    f.id === selectedFolderId ? { ...f, ...parsed } : f
                ));
            } catch { /* silent */ }
        })();
        return () => { cancelled = true; };
    }, [selectedFolderId]);

    const filtered = folders.filter(f => {
        if (search.trim()) {
            const q = search.toLowerCase();
            return f.name.toLowerCase().includes(q) ||
                f.description.toLowerCase().includes(q);
        }
        return true;
    });

    const handleCreateFolder = async () => {
        if (!newName.trim()) return;
        const existing = folders.find(f => f.name.trim().toLowerCase() === newName.trim().toLowerCase());
        if (existing) {
            showToast(`Folder "${newName.trim()}" already exists`);
            return;
        }
        try {
            const res = await fetch('/api/proxy/patient-folders', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    name: newName.trim(),
                    description: newDesc.trim(),
                }),
            });
            if (!res.ok) {
                showToast('Failed to create folder');
                return;
            }

            const created = await res.json();
            let finalFolder = parseFolder(created, 0);
            const folderId = finalFolder?.id;
            if (folderId) {
                try {
                    const refetchRes = await fetch(`/api/proxy/patient-folders/${folderId}`);
                    if (refetchRes.ok) {
                        const refetched = await refetchRes.json();
                        finalFolder = parseFolder(refetched, 0) || finalFolder;
                    }
                } catch { /* use POST body */ }
            }

            if (finalFolder) {
                setFolders(prev => [...prev, finalFolder!]);
                setSelectedFolderId(finalFolder.id);
            }
            setShowCreate(false);
            setNewName('');
            setNewDesc('');
            showToast(`Folder "${finalFolder?.name || newName.trim()}" created`);
        } catch {
            showToast('Failed to create folder');
        }
    };

    const handleDeleteFolder = async (id: string) => {
        const folder = folders.find(f => f.id === id);
        try {
            const res = await fetch(`/api/proxy/patient-folders/${id}`, { method: 'DELETE' });
            if (!res.ok) {
                showToast('Failed to delete folder');
                return;
            }
            setFolders(prev => prev.filter(f => f.id !== id));
            if (selectedFolderId === id) setSelectedFolderId(null);
            showToast(`Folder "${folder?.name}" deleted`);
        } catch {
            showToast('Failed to delete folder');
        }
    };

    const handleSaveEdit = async () => {
        if (!selectedFolder || !editName.trim()) return;
        try {
            const res = await fetch(`/api/proxy/patient-folders/${selectedFolder.id}`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    name: editName.trim(),
                    description: editDesc.trim(),
                }),
            });
            if (!res.ok) {
                showToast('Failed to update folder');
                return;
            }
            const updated = await res.json();
            const parsed = parseFolder(updated, 0);
            setFolders(prev => prev.map(f => (f.id === selectedFolder.id ? (parsed || f) : f)));
            setEditingFolder(false);
            showToast('Folder updated');
        } catch {
            showToast('Failed to update folder');
        }
    };

    const openEdit = () => {
        if (!selectedFolder) return;
        setEditName(selectedFolder.name);
        setEditDesc(selectedFolder.description);
        setEditingFolder(true);
    };

    const detailOpen = selectedFolder || showCreate;

    return (
        <>
            {toast && (
                <div className="toast-enter" style={{ position: 'fixed', top: 20, right: 20, zIndex: 999, background: 'var(--surface-card)', border: '1px solid var(--border-default)', borderRadius: 'var(--radius-md)', padding: '10px 18px', fontSize: 13, fontWeight: 600, color: 'var(--text-primary)', boxShadow: '0 4px 12px rgba(0,0,0,0.1)', display: 'flex', alignItems: 'center', gap: 8 }}>
                    <span className="material-icons-round" style={{ fontSize: 16, color: 'var(--success)' }}>check_circle</span>
                    {toast}
                </div>
            )}

            <div className="app-main">
                <TopBar title="Patient List Folders" subtitle="Create and organize folders" />

                <main style={{ flex: 1, overflow: 'auto', padding: '24px 28px', background: 'var(--bg-900)' }}>
                    <div className="fade-in" style={{ display: 'flex', gap: 12, marginBottom: 18, alignItems: 'center', flexWrap: 'wrap' }}>
                        <div style={{ position: 'relative', flex: 1, minWidth: 200, maxWidth: 300 }}>
                            <span className="material-icons-round" style={{ position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)', fontSize: 16, color: 'var(--text-disabled)', pointerEvents: 'none' }}>search</span>
                            <input
                                className="input"
                                placeholder="Search folders..."
                                value={search}
                                onChange={e => setSearch(e.target.value)}
                                style={{ paddingLeft: 34, fontSize: 12.5, height: 36, width: '100%' }}
                            />
                        </div>

                        <div style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: 8 }}>
                            <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>{filtered.length} folder{filtered.length !== 1 ? 's' : ''}</span>
                            <button className="btn btn-primary btn-sm" onClick={() => { setShowCreate(!showCreate); setSelectedFolderId(null); setEditingFolder(false); }}>
                                <span className="material-icons-round" style={{ fontSize: 14 }}>{showCreate ? 'close' : 'add'}</span>
                                {showCreate ? 'Cancel' : 'New Folder'}
                            </button>
                        </div>
                    </div>

                    <div className="fade-in" style={{ display: 'grid', gridTemplateColumns: detailOpen ? '1fr 380px' : '1fr', gap: 20, alignItems: 'start' }}>
                        <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
                            <div className="table-wrapper">
                                <table>
                                    <thead>
                                        <tr>
                                            <th style={{ width: '40%' }}>Folder Name</th>
                                            <th>Description</th>
                                            <th style={{ textAlign: 'center' }}>Patients</th>
                                            <th>Created</th>
                                            <th style={{ width: 60, textAlign: 'center' }}>Actions</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {loading ? (
                                            <tr><td colSpan={5} style={{ textAlign: 'center', padding: 40, color: 'var(--text-muted)', fontSize: 13 }}>Loading folders...</td></tr>
                                        ) : filtered.length === 0 ? (
                                            <tr><td colSpan={5} style={{ textAlign: 'center', padding: 40, color: 'var(--text-muted)', fontSize: 13 }}>No folders found</td></tr>
                                        ) : filtered.map(folder => {
                                            const isSelected = selectedFolderId === folder.id;
                                            return (
                                                <tr
                                                    key={folder.id}
                                                    onClick={() => { setSelectedFolderId(isSelected ? null : folder.id); setShowCreate(false); setEditingFolder(false); }}
                                                    style={{
                                                        cursor: 'pointer', transition: 'background 0.12s',
                                                        background: isSelected ? 'rgba(59,130,246,0.04)' : undefined,
                                                    }}
                                                >
                                                    <td>
                                                        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                                                            <div style={{
                                                                width: 30, height: 30, borderRadius: 'var(--radius-sm)',
                                                                background: isSelected ? 'var(--helix-primary)' : 'var(--surface-2)',
                                                                color: isSelected ? '#fff' : 'var(--text-secondary)',
                                                                display: 'flex', alignItems: 'center', justifyContent: 'center',
                                                                fontSize: 12, flexShrink: 0,
                                                            }}>
                                                                <span className="material-icons-round" style={{ fontSize: 16 }}>folder</span>
                                                            </div>
                                                            <div>
                                                                <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-primary)' }}>{folder.name}</div>
                                                            </div>
                                                        </div>
                                                    </td>
                                                    <td style={{ fontSize: 12, color: 'var(--text-muted)', maxWidth: 220, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{folder.description || '—'}</td>
                                                    <td style={{ textAlign: 'center', fontSize: 12.5, fontWeight: 600 }}>{folder.patientCount}</td>
                                                    <td style={{ fontSize: 12, color: 'var(--text-muted)' }}>{folder.createdAt || '—'}</td>
                                                    <td style={{ textAlign: 'center' }}>
                                                        <button
                                                            className="btn btn-danger btn-xs"
                                                            onClick={e => { e.stopPropagation(); handleDeleteFolder(folder.id); }}
                                                            title="Delete folder"
                                                            style={{ padding: '3px 6px' }}
                                                        >
                                                            <span className="material-icons-round" style={{ fontSize: 13 }}>delete</span>
                                                        </button>
                                                    </td>
                                                </tr>
                                            );
                                        })}
                                    </tbody>
                                </table>
                            </div>
                        </div>

                        {showCreate && (
                            <div className="fade-in card" style={{ position: 'sticky', top: 24 }}>
                                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
                                    <h3 style={{ fontSize: 15, fontWeight: 700 }}>Create Folder</h3>
                                    <button onClick={() => setShowCreate(false)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)', padding: 2 }}>
                                        <span className="material-icons-round" style={{ fontSize: 16 }}>close</span>
                                    </button>
                                </div>
                                <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                                    <div>
                                        <label className="label">Folder Name</label>
                                        <input className="input" value={newName} onChange={e => setNewName(e.target.value)} placeholder="e.g. ICU Patients" style={{ fontSize: 13 }} />
                                    </div>
                                    <div>
                                        <label className="label">Description</label>
                                        <textarea className="input" value={newDesc} onChange={e => setNewDesc(e.target.value)} placeholder="Brief description of the folder" style={{ fontSize: 13, minHeight: 60, resize: 'vertical' }} />
                                    </div>
                                </div>
                                <button className="btn btn-primary btn-sm" style={{ marginTop: 16, width: '100%', justifyContent: 'center' }} onClick={handleCreateFolder} disabled={!newName.trim()}>
                                    <span className="material-icons-round" style={{ fontSize: 14 }}>add</span>
                                    Create Folder
                                </button>
                            </div>
                        )}

                        {selectedFolder && !showCreate && (
                            <div className="fade-in card" style={{ position: 'sticky', top: 24 }}>
                                {editingFolder ? (
                                    <>
                                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
                                            <h3 style={{ fontSize: 15, fontWeight: 700 }}>Edit Folder</h3>
                                            <button onClick={() => setEditingFolder(false)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)', padding: 2 }}>
                                                <span className="material-icons-round" style={{ fontSize: 16 }}>close</span>
                                            </button>
                                        </div>
                                        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                                            <div>
                                                <label className="label">Folder Name</label>
                                                <input className="input" value={editName} onChange={e => setEditName(e.target.value)} style={{ fontSize: 13 }} />
                                            </div>
                                            <div>
                                                <label className="label">Description</label>
                                                <textarea className="input" value={editDesc} onChange={e => setEditDesc(e.target.value)} style={{ fontSize: 13, minHeight: 60, resize: 'vertical' }} />
                                            </div>
                                        </div>
                                        <div style={{ display: 'flex', gap: 8, marginTop: 16 }}>
                                            <button className="btn btn-primary btn-sm" style={{ flex: 1, justifyContent: 'center' }} onClick={handleSaveEdit} disabled={!editName.trim()}>Save Changes</button>
                                            <button className="btn btn-secondary btn-sm" style={{ flex: 1, justifyContent: 'center' }} onClick={() => setEditingFolder(false)}>Cancel</button>
                                        </div>
                                    </>
                                ) : (
                                    <>
                                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14 }}>
                                            <div style={{ flex: 1, minWidth: 0 }}>
                                                <h3 style={{ fontSize: 17, fontWeight: 700, letterSpacing: '-0.01em', marginBottom: 3 }}>{selectedFolder.name}</h3>
                                                <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                                                    {selectedFolder.createdAt && <span style={{ fontSize: 10, color: 'var(--text-disabled)' }}>{selectedFolder.createdAt}</span>}
                                                </div>
                                            </div>
                                            <div style={{ display: 'flex', gap: 2 }}>
                                                <button onClick={openEdit} style={{ width: 28, height: 28, borderRadius: 6, border: '1px solid var(--border-default)', background: 'var(--surface-card)', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--text-muted)', transition: 'all 0.12s' }}
                                                    onMouseEnter={e => { e.currentTarget.style.borderColor = 'var(--helix-primary)'; e.currentTarget.style.color = 'var(--helix-primary)'; }}
                                                    onMouseLeave={e => { e.currentTarget.style.borderColor = 'var(--border-default)'; e.currentTarget.style.color = 'var(--text-muted)'; }}>
                                                    <span className="material-icons-round" style={{ fontSize: 14 }}>edit</span>
                                                </button>
                                                <button onClick={() => setSelectedFolderId(null)} style={{ width: 28, height: 28, borderRadius: 6, border: 'none', background: 'transparent', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--text-disabled)', transition: 'color 0.12s' }}
                                                    onMouseEnter={e => { e.currentTarget.style.color = 'var(--text-primary)'; }}
                                                    onMouseLeave={e => { e.currentTarget.style.color = 'var(--text-disabled)'; }}>
                                                    <span className="material-icons-round" style={{ fontSize: 16 }}>close</span>
                                                </button>
                                            </div>
                                        </div>

                                        {selectedFolder.description && (
                                            <p style={{ fontSize: 12.5, color: 'var(--text-secondary)', marginBottom: 14, lineHeight: 1.5 }}>{selectedFolder.description}</p>
                                        )}

                                        <div style={{ display: 'flex', gap: 8, marginBottom: 12 }}>
                                            <div style={{ flexShrink: 0, width: 64, padding: '10px 8px', borderRadius: 8, background: 'var(--surface-2)', border: '1px solid var(--border-subtle)', textAlign: 'center', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center' }}>
                                                <div style={{ fontSize: 18, fontWeight: 700, color: 'var(--helix-primary)', lineHeight: 1 }}>{selectedFolder.patientCount}</div>
                                                <div style={{ fontSize: 9, fontWeight: 600, color: 'var(--text-disabled)', textTransform: 'uppercase', letterSpacing: '0.04em', marginTop: 3 }}>Patients</div>
                                            </div>
                                        </div>

                                        <p style={{ fontSize: 11.5, color: 'var(--text-muted)', lineHeight: 1.45, margin: 0 }}>
                                            Create and edit folders here. Patient membership is managed in the Helix app. The patient count updates when Helix has a number to show for this folder.
                                        </p>
                                    </>
                                )}
                            </div>
                        )}
                    </div>
                </main>
            </div>
        </>
    );
}
