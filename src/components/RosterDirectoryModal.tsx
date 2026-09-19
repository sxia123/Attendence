import React, { useState } from 'react';
import { Member } from '../types/attendance';
import { Users, UserPlus, X, AlertCircle, CheckCircle2 } from 'lucide-react';

interface RosterDirectoryModalProps {
  isOpen: boolean;
  onClose: () => void;
  members: Member[];
  onMemberAdded: () => void;
  isLocked: boolean;
}

export const RosterDirectoryModal: React.FC<RosterDirectoryModalProps> = ({
  isOpen,
  onClose,
  members,
  onMemberAdded,
  isLocked,
}) => {
  const [newId, setNewId] = useState<string>('');
  const [newName, setNewName] = useState<string>('');
  const [newRole, setNewRole] = useState<'member' | 'lead'>('member');
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);

  if (!isOpen) return null;

  const handleAddMember = async (e: React.FormEvent): Promise<void> => {
    e.preventDefault();
    if (isSubmitting) return;

    if (!/^\d{5}$/.test(newId.trim())) {
      setErrorMsg('ID must be exactly 5 numeric digits (e.g. 10402)');
      return;
    }

    if (!newName.trim()) {
      setErrorMsg('Member name is required');
      return;
    }

    setIsSubmitting(true);
    setErrorMsg(null);
    setSuccessMsg(null);

    try {
      const response = await fetch('/api/members', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          id: newId.trim(),
          name: newName.trim(),
          role: newRole,
        }),
      });

      const data = await response.json() as { error?: string };

      if (!response.ok) {
        throw new Error(data.error || 'Failed to add member');
      }

      setSuccessMsg(`Added ${newName.trim()} (#${newId.trim()}) successfully.`);
      setNewId('');
      setNewName('');
      setNewRole('member');
      onMemberAdded();
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : 'Error registering member');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/25">
      <div className="bg-white border border-notion-border rounded-lg shadow-xl w-full max-w-2xl max-h-[85vh] flex flex-col relative overflow-hidden">
        {/* Header */}
        <div className="px-5 py-4 border-b border-notion-border flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Users className="w-4 h-4 text-notion-text" strokeWidth={1.5} />
            <h2 className="text-sm font-semibold text-notion-text">Team Roster Directory</h2>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="text-notion-muted hover:text-notion-text p-1 rounded hover:bg-notion-surface transition-colors"
          >
            <X className="w-4 h-4" strokeWidth={1.5} />
          </button>
        </div>

        {/* Body Content */}
        <div className="p-5 overflow-y-auto space-y-6 flex-1">
          {/* Add Member Form (Only if Lead has unlocked terminal) */}
          <div className="p-4 border border-notion-border rounded bg-notion-surface/40">
            <h3 className="text-xs font-semibold text-notion-text mb-2 flex items-center gap-1.5">
              <UserPlus className="w-3.5 h-3.5 text-notion-muted" strokeWidth={1.5} />
              Register New Member
            </h3>

            {isLocked ? (
              <p className="text-xs text-notion-muted italic">
                Terminal is currently locked. Unlock with a Lead PIN to register or edit members.
              </p>
            ) : (
              <form onSubmit={(e) => { void handleAddMember(e); }} className="space-y-3">
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  <div>
                    <label className="block text-[11px] font-medium text-notion-muted mb-1">
                      5-Digit ID
                    </label>
                    <input
                      type="text"
                      maxLength={5}
                      pattern="[0-9]*"
                      placeholder="e.g. 10204"
                      value={newId}
                      onChange={(e) => setNewId(e.target.value.replace(/\D/g, ''))}
                      className="w-full px-2.5 py-1.5 text-xs font-mono border border-notion-border rounded bg-white focus:border-notion-text"
                    />
                  </div>
                  <div>
                    <label className="block text-[11px] font-medium text-notion-muted mb-1">
                      Full Name
                    </label>
                    <input
                      type="text"
                      placeholder="e.g. Jordan Miller"
                      value={newName}
                      onChange={(e) => setNewName(e.target.value)}
                      className="w-full px-2.5 py-1.5 text-xs border border-notion-border rounded bg-white focus:border-notion-text"
                    />
                  </div>
                  <div>
                    <label className="block text-[11px] font-medium text-notion-muted mb-1">
                      Role
                    </label>
                    <select
                      value={newRole}
                      onChange={(e) => setNewRole(e.target.value as 'member' | 'lead')}
                      className="w-full px-2.5 py-1.5 text-xs border border-notion-border rounded bg-white focus:border-notion-text"
                    >
                      <option value="member">Member</option>
                      <option value="lead">Lead (Admin)</option>
                    </select>
                  </div>
                </div>

                {errorMsg && (
                  <div className="text-xs text-[#932C2C] bg-[#FBE4E4]/70 p-2 rounded border border-[#F6C6C6] flex items-center gap-1.5">
                    <AlertCircle className="w-3.5 h-3.5 shrink-0" strokeWidth={1.5} />
                    <span>{errorMsg}</span>
                  </div>
                )}

                {successMsg && (
                  <div className="text-xs text-[#2B593F] bg-[#EDF3EC] p-2 rounded border border-[#D5E6D3] flex items-center gap-1.5">
                    <CheckCircle2 className="w-3.5 h-3.5 shrink-0" strokeWidth={1.5} />
                    <span>{successMsg}</span>
                  </div>
                )}

                <div className="flex justify-end">
                  <button
                    type="submit"
                    disabled={isSubmitting || newId.length !== 5 || !newName.trim()}
                    className="px-3 py-1.5 text-xs font-medium text-white bg-[#37352F] hover:bg-[#201F1D] disabled:opacity-40 rounded transition-colors"
                  >
                    {isSubmitting ? 'Adding...' : 'Add Member'}
                  </button>
                </div>
              </form>
            )}
          </div>

          {/* Existing Members Table */}
          <div>
            <div className="text-xs font-semibold text-notion-text mb-2 flex items-center justify-between">
              <span>Registered Members ({members.length})</span>
            </div>

            <div className="border border-notion-border rounded overflow-hidden">
              <table className="w-full text-left text-xs border-collapse">
                <thead>
                  <tr className="bg-notion-surface/60 border-b border-notion-border text-notion-muted">
                    <th className="py-2 px-3 border-r border-notion-border/60 w-24 font-mono font-medium">5-Digit ID</th>
                    <th className="py-2 px-3 border-r border-notion-border/60 font-medium">Name</th>
                    <th className="py-2 px-3 border-r border-notion-border/60 w-24 font-medium">Role</th>
                    <th className="py-2 px-3 w-28 font-medium">Live Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-notion-border/50">
                  {members.map((m) => (
                    <tr key={m.id} className="hover:bg-notion-surface/40">
                      <td className="py-2 px-3 border-r border-notion-border/40 font-mono text-notion-muted">
                        #{m.id}
                      </td>
                      <td className="py-2 px-3 border-r border-notion-border/40 font-medium text-notion-text">
                        {m.name}
                      </td>
                      <td className="py-2 px-3 border-r border-notion-border/40">
                        {m.role === 'lead' ? (
                          <span className="inline-block px-1.5 py-0.2 rounded text-[10px] font-mono bg-notion-tagAmber text-notion-tagAmberText border border-[#F4DCB8]">
                            Lead
                          </span>
                        ) : (
                          <span className="inline-block px-1.5 py-0.2 rounded text-[10px] font-mono bg-notion-tagGray text-notion-tagGrayText">
                            Member
                          </span>
                        )}
                      </td>
                      <td className="py-2 px-3">
                        {m.isClockedIn ? (
                          <span className="inline-block px-1.5 py-0.5 rounded text-[10px] font-mono bg-[#EDF3EC] text-[#2B593F]">
                            Clocked In
                          </span>
                        ) : (
                          <span className="inline-block px-1.5 py-0.5 rounded text-[10px] font-mono text-notion-muted">
                            Clocked Out
                          </span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="px-5 py-3 border-t border-notion-border bg-notion-surface/40 flex justify-end">
          <button
            type="button"
            onClick={onClose}
            className="px-3 py-1.5 text-xs text-notion-muted hover:text-notion-text border border-notion-border rounded hover:bg-white transition-colors"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
};
