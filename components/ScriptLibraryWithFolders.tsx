
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { FolderPlus, Folder as FolderIcon, FolderOpen, FileCode, Search, ChevronRight, ChevronDown, Loader2, Trash2, MoveRight, Shield, ArrowUp, Edit2 } from 'lucide-react';
import { AutomationRequest, DEVELOPER_ROLE } from '../types';
import { API_BASE_URL, apiClient } from '../services/apiClient';
import { useAuth } from '../context/AuthContext';

interface ScriptTreeNode {
  id: number;
  name: string;
  type: 'FOLDER' | 'FILE';
  parentId?: number;
  requestId?: number;
  createdAt: number;
  updatedAt: number;
  children?: ScriptTreeNode[];
  request?: AutomationRequest;
}

interface Props {
  requests: AutomationRequest[];
  onViewRequest: (req: AutomationRequest) => void;
}

const findNodeById = (nodes: ScriptTreeNode[], id: number | null): ScriptTreeNode | null => {
  if (id === null) return null;
  for (const node of nodes) {
    if (node.id === id) return node;
    if (node.children) {
      const found = findNodeById(node.children, id);
      if (found) return found;
    }
  }
  return null;
};

const flattenFolders = (nodes: ScriptTreeNode[], depth = 0, omitIds: Set<number> = new Set()): { id: number; name: string; depth: number }[] => {
  const list: { id: number; name: string; depth: number }[] = [];
  nodes.forEach((node) => {
    if (node.type === 'FOLDER' && !omitIds.has(node.id)) {
      list.push({ id: node.id, name: node.name, depth });
      if (node.children) {
        list.push(...flattenFolders(node.children, depth + 1, omitIds));
      }
    }
  });
  return list;
};

const collectDescendants = (node?: ScriptTreeNode): Set<number> => {
  const ids = new Set<number>();
  if (!node?.children) return ids;
  const walk = (current: ScriptTreeNode) => {
    current.children?.forEach((child) => {
      ids.add(child.id);
      walk(child);
    });
  };
  walk(node);
  return ids;
};

const findNodeByName = (nodes: ScriptTreeNode[], name: string): ScriptTreeNode | null => {
  for (const node of nodes) {
    if (node.name === name) return node;
    if (node.children) {
      const found = findNodeByName(node.children, name);
      if (found) return found;
    }
  }
  return null;
};

export const ScriptLibraryWithFolders: React.FC<Props> = ({ requests, onViewRequest }) => {
  const { user } = useAuth();
  const isDeveloper = user?.role === DEVELOPER_ROLE;

  const [tree, setTree] = useState<ScriptTreeNode[]>([]);
  const [selectedFolderId, setSelectedFolderId] = useState<number | null>(null);
  const [expanded, setExpanded] = useState<Set<number>>(new Set());
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [showNewFolder, setShowNewFolder] = useState(false);
  const [newFolderName, setNewFolderName] = useState('');
  const [newFolderParent, setNewFolderParent] = useState<number | null>(null);
  const [search, setSearch] = useState('');
  const [editingId, setEditingId] = useState<number | null>(null);
  const [editingName, setEditingName] = useState('');
  const [feedback, setFeedback] = useState<string | null>(null);
  const [downloadingAll, setDownloadingAll] = useState(false);

  const requestIndex = useMemo(() => {
    const map = new Map<string | number, AutomationRequest>();
    requests.forEach((r) => map.set(String(r.id), r));
    return map;
  }, [requests]);

  const loadTree = useCallback(async () => {
    setLoading(true);
    try {
      const data = await apiClient.get('/script-tree');
      setTree(data);
      if (data.length > 0 && selectedFolderId === null) {
        const unsorted = findNodeByName(data, 'Unsorted');
        const defaultId = unsorted?.id ?? data[0].id;
        setSelectedFolderId(defaultId);
        setExpanded(new Set(defaultId ? [defaultId] : []));
      }
    } catch (err) {
      console.error('Failed to load script tree', err);
    } finally {
      setLoading(false);
    }
  }, [selectedFolderId]);

  useEffect(() => {
    loadTree();
  }, [loadTree]);

  const toggleExpand = (id: number) => {
    setExpanded((prev) => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  };

  const folderOptions = useMemo(() => flattenFolders(tree), [tree]);
  const rootFolderId = tree[0]?.id ?? null;
  const unsortedFolder = useMemo(() => findNodeByName(tree, 'Unsorted'), [tree]);
  const currentFolder = useMemo(() => {
    if (selectedFolderId === null) return unsortedFolder || tree[0];
    return findNodeById(tree, selectedFolderId) || unsortedFolder || tree[0];
  }, [selectedFolderId, tree, unsortedFolder]);

  const nodeIndex = useMemo(() => {
    const map = new Map<number, { node: ScriptTreeNode; parentId: number | null }>();
    const walk = (node: ScriptTreeNode, parentId: number | null) => {
      map.set(node.id, { node, parentId });
      node.children?.forEach((child) => walk(child, node.id));
    };
    tree.forEach((node) => walk(node, null));
    return map;
  }, [tree]);

  const breadcrumb = useMemo(() => {
    const crumbs: ScriptTreeNode[] = [];
    let cursor: number | null = selectedFolderId ?? rootFolderId;
    while (cursor !== null) {
      const entry = nodeIndex.get(cursor);
      if (!entry) break;
      crumbs.unshift(entry.node);
      cursor = entry.parentId;
    }
    return crumbs;
  }, [nodeIndex, selectedFolderId, rootFolderId]);

  const parentId = useMemo(() => {
    if (selectedFolderId === null) return null;
    const entry = nodeIndex.get(selectedFolderId);
    return entry?.parentId ?? null;
  }, [nodeIndex, selectedFolderId]);

  const scriptNodes = currentFolder?.children?.filter((n) => n.type === 'FILE') || [];
  const childFolders = currentFolder?.children?.filter((n) => n.type === 'FOLDER') || [];

  const resolveRequest = useCallback(
    (node: ScriptTreeNode): AutomationRequest | null => {
      if (!node.requestId) return null;
      return requestIndex.get(String(node.requestId)) || requestIndex.get(node.requestId) || node.request || null;
    },
    [requestIndex]
  );

  const filteredScripts = useMemo(() => {
    return scriptNodes.filter((node) => {
      const req = resolveRequest(node);
      const haystack = `${node.name} ${req?.title || ''} ${req?.projectName || ''}`.toLowerCase();
      return haystack.includes(search.toLowerCase());
    });
  }, [scriptNodes, resolveRequest, search]);

  const handleDownload = useCallback((e: React.MouseEvent, node: ScriptTreeNode) => {
    e.stopPropagation();
    const req = resolveRequest(node);
    const attachment = req?.resultFiles?.find((att) => att.name === node.name) || req?.resultFiles?.[0];
    if (!attachment) {
      setFeedback('No files available to download for this request yet.');
      return;
    }
    const byteString = atob(attachment.data.split(',')[1]);
    const mimeString = attachment.data.split(',')[0].split(':')[1].split(';')[0];
    const ab = new ArrayBuffer(byteString.length);
    const ia = new Uint8Array(ab);
    for (let i = 0; i < byteString.length; i++) {
      ia[i] = byteString.charCodeAt(i);
    }
    const blob = new Blob([ab], { type: mimeString });
    const element = document.createElement('a');
    element.href = URL.createObjectURL(blob);
    element.download = attachment.name;
    document.body.appendChild(element);
    element.click();
    document.body.removeChild(element);
  }, [resolveRequest]);

  const handleCreateFolder = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newFolderName) return;
    setSaving(true);
    try {
      await apiClient.post('/script-tree/folder', {
        name: newFolderName,
        parentId: newFolderParent || selectedFolderId || unsortedFolder?.id || rootFolderId,
      });
      setShowNewFolder(false);
      setNewFolderName('');
      setNewFolderParent(null);
      await loadTree();
    } catch (err: any) {
      setFeedback(err.message || 'Failed to create folder');
    } finally {
      setSaving(false);
    }
  };

  const moveNode = async (nodeId: number, parentId: number) => {
    setSaving(true);
    try {
      await apiClient.put(`/script-tree/${nodeId}`, { parentId });
      await loadTree();
    } catch (err: any) {
      setFeedback(err.message || 'Failed to move item');
    } finally {
      setSaving(false);
    }
  };

  const renameNode = async (nodeId: number, name: string) => {
    if (!name.trim()) return;
    setSaving(true);
    try {
      await apiClient.put(`/script-tree/${nodeId}`, { name });
      await loadTree();
    } catch (err: any) {
      setFeedback(err.message || 'Failed to rename item');
    } finally {
      setSaving(false);
    }
  };

  const deleteNode = async (nodeId: number) => {
    setSaving(true);
    try {
      await apiClient.delete(`/script-tree/${nodeId}`);
      await loadTree();
      if (nodeId === selectedFolderId) {
        setSelectedFolderId(unsortedFolder?.id || rootFolderId);
      }
    } catch (err: any) {
      setFeedback(err.message || 'Failed to delete item');
    } finally {
      setSaving(false);
    }
  };

  const handleDownloadAll = async () => {
    setDownloadingAll(true);
    setFeedback(null);
    try {
      const token = sessionStorage.getItem('rah_access_token');
      const res = await fetch(`${API_BASE_URL}/script-tree/export`, {
        headers: token ? { Authorization: `Bearer ${token}` } : undefined,
      });
      if (!res.ok) {
        const text = await res.text();
        throw new Error(text || 'Failed to download library');
      }
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = 'script-library.zip';
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    } catch (err: any) {
      setFeedback(err.message || 'Failed to download library');
    } finally {
      setDownloadingAll(false);
    }
  };

  const renderFolderTree = (node: ScriptTreeNode, depth = 0) => {
    if (node.type !== 'FOLDER') return null;
    const isSelected = node.id === selectedFolderId;
    const hasChildren = node.children?.some((c) => c.type === 'FOLDER');
    const isOpen = expanded.has(node.id);

    return (
      <div key={node.id} className="pl-2">
        <div
          className={`flex items-center justify-between rounded-md px-2 py-1.5 text-sm cursor-pointer transition ${
            isSelected
              ? 'bg-indigo-50 text-indigo-700 border border-indigo-100 dark:bg-indigo-900/40 dark:text-indigo-100 dark:border-indigo-700'
              : 'hover:bg-slate-100 dark:hover:bg-slate-800/70 text-slate-700 dark:text-slate-200'
          }`}
          onClick={() => {
            setSelectedFolderId(node.id);
            setExpanded((prev) => new Set(prev).add(node.id));
          }}
        >
          <div className="flex items-center gap-2 min-w-0">
            {hasChildren ? (
              <button
                className="text-slate-500 hover:text-slate-800 dark:text-slate-400 dark:hover:text-slate-200"
                onClick={(e) => {
                  e.stopPropagation();
                  toggleExpand(node.id);
                }}
              >
                {isOpen ? <ChevronDown className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
              </button>
            ) : (
              <span className="w-4 h-4" />
            )}
            {isOpen ? <FolderOpen className="w-4 h-4 text-indigo-600" /> : <FolderIcon className="w-4 h-4 text-slate-500" />}
            <span className="truncate" title={node.name}>{node.name}</span>
          </div>
          {isDeveloper && node.id !== rootFolderId && (
            <button
              onClick={(e) => {
                e.stopPropagation();
                deleteNode(node.id);
              }}
              className="text-slate-400 hover:text-red-500"
              title="Delete folder"
            >
              <Trash2 className="w-4 h-4" />
            </button>
          )}
        </div>
        {isOpen && node.children?.filter((c) => c.type === 'FOLDER').map((child) => renderFolderTree(child, depth + 1))}
      </div>
    );
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="w-8 h-8 animate-spin text-indigo-600" />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="bg-white dark:bg-slate-800 p-6 rounded-xl border border-slate-200 dark:border-slate-700 shadow-sm">
        <div className="flex flex-col gap-3 mb-4">
          <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-3">
            <div className="flex items-center gap-3 flex-wrap">
              <h1 className="text-2xl font-bold text-slate-900 dark:text-white">Script Library</h1>
              <button
                onClick={handleDownloadAll}
                className="px-3 py-2 text-sm rounded-lg bg-slate-900 text-white hover:bg-slate-800 flex items-center gap-2"
                disabled={downloadingAll}
              >
                {downloadingAll ? <Loader2 className="w-4 h-4 animate-spin" /> : <FileCode className="w-4 h-4" />} Download Library
              </button>
            </div>
            <div className="relative w-full md:w-72">
              <Search className="absolute left-3 top-2.5 w-4 h-4 text-slate-400" />
              <input
                type="text"
                placeholder="Search scripts..."
                className="pl-9 pr-4 py-2 border border-slate-300 dark:border-slate-600 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none w-full bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
            </div>
          </div>
          <p className="text-slate-500 dark:text-slate-400 mt-1 flex items-center gap-2">
            <Shield className="w-4 h-4" /> Read access for everyone; only developers can organize. Anyone can export a full copy.
          </p>
          <p className="text-xs text-slate-500 dark:text-slate-400">
            Downloading exports the entire library as a zip (all folders and files). Treat it as a full backup and store it securely.
          </p>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-[320px,1fr] gap-4">
          <div className="bg-slate-50 dark:bg-slate-900 rounded-lg border border-slate-200 dark:border-slate-700 p-3">
            <div className="flex items-center justify-between mb-2">
              <h3 className="text-sm font-semibold text-slate-700 dark:text-slate-200">Folders</h3>
              {isDeveloper && (
                <button
                  onClick={() => {
                    setShowNewFolder(true);
                    setNewFolderParent(selectedFolderId || unsortedFolder?.id || rootFolderId);
                  }}
                  className="text-sm text-indigo-600 hover:text-indigo-700 flex items-center gap-1"
                >
                  <FolderPlus className="w-4 h-4" /> New
                </button>
              )}
            </div>
            <div className="space-y-1 max-h-[520px] overflow-y-auto pr-1">
              {tree.map((node) => renderFolderTree(node))}
            </div>
          </div>

          <div className="bg-white dark:bg-slate-900 rounded-lg border border-slate-200 dark:border-slate-700 p-4 space-y-4">
            {feedback && (
              <div className="px-3 py-2 rounded-lg text-sm bg-slate-50 dark:bg-slate-800 text-slate-700 dark:text-slate-200 border border-slate-200 dark:border-slate-700">
                {feedback}
              </div>
            )}
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div className="flex flex-wrap items-center gap-3 text-sm text-slate-500 dark:text-slate-400">
                <div className="flex items-center gap-2">
                  <span className="uppercase text-xs font-semibold text-slate-400">Path</span>
                  {parentId !== null && (
                    <button
                      className="flex items-center gap-1 text-xs px-2 py-1 rounded-md border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-100 hover:bg-slate-100 dark:hover:bg-slate-800 font-semibold"
                      onClick={() => setSelectedFolderId(parentId)}
                      title="Up one level"
                    >
                      <ArrowUp className="w-3.5 h-3.5" /> Up
                    </button>
                  )}
                </div>
                {breadcrumb.map((crumb, idx) => (
                  <React.Fragment key={crumb.id}>
                    {idx > 0 && <span className="text-slate-400">/</span>}
                    <button
                      className={`hover:text-indigo-600 ${crumb.id === selectedFolderId ? 'font-semibold text-slate-900 dark:text-white' : ''}`}
                      onClick={() => setSelectedFolderId(crumb.id)}
                    >
                      {crumb.name}
                    </button>
                  </React.Fragment>
                ))}
              </div>

              {isDeveloper && (
                <div className="flex items-center gap-2 text-xs text-slate-500 dark:text-slate-300">
                  <span className="px-2 py-1 rounded-full bg-indigo-50 dark:bg-indigo-900/40 text-indigo-700 dark:text-indigo-200">Completed requests drop into "Unsorted". Move them where they belong.</span>
                </div>
              )}
            </div>

            <div className="rounded-lg border border-slate-200 dark:border-slate-700 overflow-hidden">
              <div className="bg-slate-50 dark:bg-slate-800 text-[11px] uppercase tracking-wide text-slate-500 dark:text-slate-300 px-3 py-2 grid grid-cols-[minmax(0,1fr)_auto] gap-3">
                <span>Name</span>
                <span className="text-right pr-1">Actions</span>
              </div>
              {childFolders.length === 0 && filteredScripts.length === 0 ? (
                <div className="text-center py-10 text-slate-500 dark:text-slate-300">
                  <FileCode className="w-10 h-10 text-slate-400 mx-auto mb-3" />
                  <p className="font-medium">Nothing here yet</p>
                  <p className="text-sm">Completed requests land in "Unsorted". Move them into the right folder.</p>
                </div>
              ) : (
                <div className="divide-y divide-slate-200 dark:divide-slate-700">
                  {[...childFolders.map(f => ({ kind: 'folder' as const, node: f })), ...filteredScripts.map(f => ({ kind: 'file' as const, node: f }))].map(({ kind, node }) => {
                    const req = resolveRequest(node as ScriptTreeNode);
                    const destinations = kind === 'file' ? flattenFolders(tree) : flattenFolders(tree, 0, collectDescendants(node as ScriptTreeNode));
                    const childCount = kind === 'folder' ? node.children?.length || 0 : 0;
                    return (
                      <div
                        key={node.id}
                        className="grid grid-cols-[minmax(0,1fr)_auto] gap-3 items-center px-3 py-2 hover:bg-slate-50 dark:hover:bg-slate-800 min-w-0"
                      >
                        <div className="flex items-center gap-2 min-w-0 flex-1">
                          {kind === 'folder' ? (
                            (expanded.has(node.id) || selectedFolderId === node.id) ? (
                              <FolderOpen className="w-4 h-4 text-indigo-500 flex-shrink-0" />
                            ) : (
                              <FolderIcon className="w-4 h-4 text-slate-500 flex-shrink-0" />
                            )
                          ) : (
                            <FileCode className="w-4 h-4 text-slate-500 flex-shrink-0" />
                          )}
                          {editingId === node.id ? (
                            <div className="flex items-center gap-2 min-w-0">
                              <input
                                value={editingName}
                                onChange={(e) => setEditingName(e.target.value)}
                                className="text-sm px-2 py-1 rounded border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100"
                              />
                              <button
                                onClick={() => { renameNode(node.id, editingName); setEditingId(null); }}
                                className="text-xs text-indigo-600 dark:text-indigo-300"
                              >
                                Save
                              </button>
                              <button
                                onClick={() => setEditingId(null)}
                                className="text-xs text-slate-500 dark:text-slate-300"
                              >
                                Cancel
                              </button>
                            </div>
                          ) : (
                            <div className="min-w-0">
                              <button
                                onClick={() => {
                                  if (kind === 'folder') {
                                    setSelectedFolderId(node.id);
                                    setExpanded((prev) => new Set(prev).add(node.id));
                                  } else if (req) {
                                    onViewRequest(req);
                                  }
                                }}
                                className="text-sm font-semibold text-slate-900 dark:text-slate-100 truncate text-left hover:text-indigo-600"
                              >
                                {node.name}
                              </button>
                              <p className="text-[11px] text-slate-500 dark:text-slate-300 truncate">
                                {kind === 'folder'
                                  ? childCount ? `${childCount} item${childCount === 1 ? '' : 's'}` : 'Empty folder'
                                  : 'File'}
                              </p>
                            </div>
                          )}
                        </div>
                        <div className="flex justify-end items-center gap-2 flex-wrap sm:flex-nowrap shrink-0">
                          {kind === 'file' && (
                            <button
                              onClick={(e) => { e.stopPropagation(); handleDownload(e, node as ScriptTreeNode); }}
                              className="text-xs text-indigo-600 dark:text-indigo-300 hover:underline"
                            >
                              Download
                            </button>
                          )}
                          {isDeveloper && (
                            <>
                              <button
                                onClick={() => { setEditingId(node.id); setEditingName(node.name); }}
                                className="text-xs text-slate-600 dark:text-slate-200 hover:underline flex items-center gap-1"
                              >
                                <Edit2 className="w-3 h-3" /> Rename
                              </button>
                              <select
                                className="text-xs border border-slate-300 dark:border-slate-600 rounded-md px-2 py-1 bg-white dark:bg-slate-900 text-slate-700 dark:text-slate-200 max-w-[180px]"
                                defaultValue=""
                                onChange={(e) => {
                                  if (e.target.value) moveNode(node.id, Number(e.target.value));
                                  e.target.value = '';
                                }}
                              >
                                <option value="">{kind === 'folder' ? 'Move folder...' : 'Move file...'}</option>
                                {destinations.map((opt) => (
                                  <option key={opt.id} value={opt.id}>{' '.repeat(opt.depth * 2)}{opt.name}</option>
                                ))}
                              </select>
                              <button
                                onClick={() => deleteNode(node.id)}
                                className="text-xs text-red-500 hover:text-red-600"
                              >
                                Delete
                              </button>
                            </>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      {showNewFolder && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center p-4 z-50">
          <div className="bg-white dark:bg-slate-800 rounded-xl shadow-2xl max-w-md w-full p-6 border border-slate-200 dark:border-slate-700">
            <h3 className="text-xl font-bold text-slate-900 dark:text-white mb-4">Create New Folder</h3>
            <form onSubmit={handleCreateFolder} className="space-y-4">
              <div>
                <label className="block text-sm font-semibold text-slate-700 dark:text-slate-300 mb-2">Folder Name</label>
                <input
                  type="text"
                  required
                  className="w-full px-4 py-2 border border-slate-300 dark:border-slate-600 rounded-lg focus:ring-2 focus:ring-indigo-500 outline-none bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100"
                  placeholder="e.g., MEP / QA / Templates"
                  value={newFolderName}
                  onChange={(e) => setNewFolderName(e.target.value)}
                />
              </div>
              <div>
                <label className="block text-sm font-semibold text-slate-700 dark:text-slate-300 mb-2">Parent Folder</label>
                <select
                  className="w-full px-4 py-2 border border-slate-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100"
                  value={newFolderParent || unsortedFolder?.id || rootFolderId || ''}
                  onChange={(e) => setNewFolderParent(Number(e.target.value))}
                >
                  {folderOptions.map((opt) => (
                    <option key={opt.id} value={opt.id}>{' '.repeat(opt.depth * 2)}{opt.name}</option>
                  ))}
                </select>
              </div>
              <div className="flex gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => setShowNewFolder(false)}
                  className="flex-1 px-4 py-2 border border-slate-300 dark:border-slate-600 text-slate-700 dark:text-slate-300 rounded-lg hover:bg-slate-50 dark:hover:bg-slate-900 transition font-medium"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={saving}
                  className="flex-1 px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition font-medium shadow-sm flex items-center justify-center gap-2"
                >
                  {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <><MoveRight className="w-4 h-4" /> Create</>}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
