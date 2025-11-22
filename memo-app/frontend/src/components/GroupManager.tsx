import { useState, useEffect } from 'react';
import { Plus, Trash2, Edit2, ChevronLeft, Users, Save } from 'lucide-react';
import { bridge } from '../bridge';
import { Group } from '../types';
import { MultiEmailInput } from './MultiEmailInput';
import { Button } from './ui/button';
import { Input } from './ui/input';


interface GroupManagerProps {
    knownUsers: string[];
}

export const GroupManager = ({ knownUsers }: GroupManagerProps) => {
    const [groups, setGroups] = useState<Group[]>([]);
    const [loading, setLoading] = useState(true);
    const [isEditing, setIsEditing] = useState(false);
    const [editingGroup, setEditingGroup] = useState<Group | null>(null);

    // Form state
    const [name, setName] = useState('');
    const [recipients, setRecipients] = useState<string[]>([]);
    const [error, setError] = useState('');

    useEffect(() => {
        loadGroups();
    }, []);

    const loadGroups = async () => {
        try {
            const loadedGroups = await bridge.getGroups();
            setGroups(loadedGroups);
        } catch (error) {
            console.error('Failed to load groups:', error);
        } finally {
            setLoading(false);
        }
    };

    const handleSaveGroup = async () => {
        if (!name.trim()) {
            setError('Group name is required');
            return;
        }
        if (recipients.length === 0) {
            setError('Add at least one recipient');
            return;
        }

        try {
            let updatedGroups = [...groups];

            if (editingGroup) {
                // Update existing
                updatedGroups = groups.map(g =>
                    g.id === editingGroup.id
                        ? { ...g, name, recipients }
                        : g
                );
            } else {
                // Create new
                const newGroup: Group = {
                    id: Date.now().toString(36) + Math.random().toString(36).substring(2),
                    name,
                    recipients,
                    createdAt: Date.now(),
                };
                updatedGroups.push(newGroup);
            }

            await bridge.saveGroups(updatedGroups);
            setGroups(updatedGroups);
            resetForm();
        } catch (error) {
            console.error('Failed to save group:', error);
            setError('Failed to save group');
        }
    };

    const handleDeleteGroup = async (id: string) => {
        if (!confirm('Are you sure you want to delete this group?')) return;

        try {
            const updatedGroups = groups.filter(g => g.id !== id);
            await bridge.saveGroups(updatedGroups);
            setGroups(updatedGroups);
        } catch (error) {
            console.error('Failed to delete group:', error);
        }
    };

    const startEdit = (group: Group) => {
        setEditingGroup(group);
        setName(group.name);
        setRecipients(group.recipients);
        setIsEditing(true);
        setError('');
    };

    const startCreate = () => {
        setEditingGroup(null);
        setName('');
        setRecipients([]);
        setIsEditing(true);
        setError('');
    };

    const resetForm = () => {
        setIsEditing(false);
        setEditingGroup(null);
        setName('');
        setRecipients([]);
        setError('');
    };

    if (isEditing) {
        return (
            <div className="space-y-6 pb-24">
                <div className="flex items-center gap-3 mb-6">
                    <button
                        onClick={resetForm}
                        className="p-2 -ml-2 rounded-full text-slate-600 hover:bg-slate-100 transition-colors"
                    >
                        <ChevronLeft className="w-6 h-6" />
                    </button>
                    <h2 className="text-xl font-bold text-slate-900">
                        {editingGroup ? 'Edit Group' : 'New Group'}
                    </h2>
                </div>

                <div className="bg-white rounded-xl border border-slate-200 p-5 space-y-5">
                    <div className="space-y-2">
                        <label className="text-sm font-medium text-slate-700">Group Name</label>
                        <Input
                            value={name}
                            onChange={(e) => setName(e.target.value)}
                            placeholder="e.g., Marketing Team"
                            className="tap-highlight"
                        />
                    </div>

                    <div className="space-y-2">
                        <label className="text-sm font-medium text-slate-700">Recipients</label>
                        <MultiEmailInput
                            emails={recipients}
                            onChange={setRecipients}
                            suggestions={knownUsers}
                            groups={groups}
                            placeholder="Add members..."
                        />
                    </div>

                    {error && (
                        <div className="text-red-500 text-sm bg-red-50 p-3 rounded-lg">
                            {error}
                        </div>
                    )}
                </div>

                <div className="flex gap-3">
                    <Button
                        variant="outline"
                        className="flex-1"
                        onClick={resetForm}
                    >
                        Cancel
                    </Button>
                    <Button
                        className="flex-1"
                        onClick={handleSaveGroup}
                    >
                        <Save className="w-4 h-4 mr-2" />
                        Save Group
                    </Button>
                </div>
            </div>
        );
    }

    return (
        <div className="space-y-6 pb-24">

            <button
                onClick={startCreate}
                className="w-full bg-primary-50 border-2 border-dashed border-primary-200 rounded-xl p-4 flex items-center justify-center gap-2 text-primary-700 font-semibold hover:bg-primary-100 transition-colors active:scale-[0.99]"
            >
                <Plus className="w-5 h-5" />
                Create New Group
            </button>

            <div className="space-y-3">
                {loading ? (
                    <div className="flex justify-center py-12">
                        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-600"></div>
                    </div>
                ) : groups.length === 0 ? (
                    <div className="text-center py-12 text-slate-400">
                        <Users className="w-12 h-12 mx-auto mb-3 opacity-50" />
                        <p>No groups created yet</p>
                    </div>
                ) : (
                    groups.map(group => (
                        <div
                            key={group.id}
                            className="bg-white rounded-xl border border-slate-200 p-4 shadow-sm"
                        >
                            <div className="flex justify-between items-start mb-2">
                                <div>
                                    <h3 className="font-semibold text-slate-900">{group.name}</h3>
                                    <p className="text-sm text-slate-500">
                                        {group.recipients.length} members
                                    </p>
                                </div>
                                <div className="flex gap-1">
                                    <button
                                        onClick={() => startEdit(group)}
                                        className="p-2 text-slate-400 hover:text-primary-600 hover:bg-primary-50 rounded-lg transition-colors"
                                    >
                                        <Edit2 className="w-4 h-4" />
                                    </button>
                                    <button
                                        onClick={() => handleDeleteGroup(group.id)}
                                        className="p-2 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                                    >
                                        <Trash2 className="w-4 h-4" />
                                    </button>
                                </div>
                            </div>
                            <div className="flex flex-wrap gap-1.5">
                                {group.recipients.slice(0, 5).map(email => (
                                    <span
                                        key={email}
                                        className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-slate-100 text-slate-600"
                                    >
                                        {email.split('@')[0]}
                                    </span>
                                ))}
                                {group.recipients.length > 5 && (
                                    <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-slate-100 text-slate-500">
                                        +{group.recipients.length - 5} more
                                    </span>
                                )}
                            </div>
                        </div>
                    ))
                )}
            </div>
        </div>
    );
};
