import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Announcement } from '../types';
import { 
  X, 
  Plus, 
  Bell, 
  MapPin, 
  Clock, 
  Send, 
  Trash2, 
  Calendar,
  CheckCircle2,
  AlertCircle,
  Lock,
  ShieldCheck
} from 'lucide-react';
import { 
  fetchAnnouncementsFromDB, 
  createAnnouncementInDB, 
  deleteAnnouncementInDB 
} from '../services/supabaseService';
import { playClickTick, playSuccessChime, playWarningBuzzer } from '../utils/audioFeedback';
import { canManageAnnouncements } from '../utils/rbac';
import { UserSession } from '../types';

interface AnnouncementsModalProps {
  isOpen: boolean;
  onClose: () => void;
  onShowToast: (msg: string, type: 'success' | 'error' | 'info') => void;
  session?: UserSession | null;
}

export const AnnouncementsModal: React.FC<AnnouncementsModalProps> = ({
  isOpen,
  onClose,
  onShowToast,
  session,
}) => {
  const canBroadcast = canManageAnnouncements(session);
  const [announcements, setAnnouncements] = useState<Announcement[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [showCreate, setShowCreate] = useState(false);
  const [announcementToDelete, setAnnouncementToDelete] = useState<{ id: string; title: string } | null>(null);

  // Form states
  const [title, setTitle] = useState('');
  const [content, setContent] = useState('');
  const [location, setLocation] = useState('Lab Robotika MAN 2 Kota Bekasi');
  const [eventDate, setEventDate] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const loadAnnouncements = async () => {
    setIsLoading(true);
    const data = await fetchAnnouncementsFromDB();
    setAnnouncements(data);
    setIsLoading(false);
  };

  useEffect(() => {
    if (isOpen) {
      loadAnnouncements();
      setShowCreate(false);
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const handleCreateAnnouncement = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!canBroadcast) {
      onShowToast('Security Restriction: Only administrators and executive board officers are permitted to broadcast announcements.', 'error');
      return;
    }
    if (!title.trim() || !content.trim()) return;

    setIsSubmitting(true);
    playClickTick();

    const res = await createAnnouncementInDB({
      title: title.trim(),
      content: content.trim(),
      location: location.trim(),
      event_date: eventDate ? new Date(eventDate).toISOString() : undefined,
      author_name: session?.name || session?.username || 'Executive Officer',
    });

    setIsSubmitting(false);
    if (res.success) {
      playSuccessChime();
      onShowToast('New announcement successfully broadcast to all members!', 'success');
      setTitle('');
      setContent('');
      setShowCreate(false);
      loadAnnouncements();
    } else {
      onShowToast(res.error || 'Failed to broadcast announcement.', 'error');
    }
  };

  const handleDeleteAnnouncement = (id: string, titleStr: string) => {
    if (!canBroadcast) {
      playWarningBuzzer();
      onShowToast('Permission Denied: Only administrators and executive board officers can delete announcements.', 'error');
      return;
    }
    playClickTick();
    setAnnouncementToDelete({ id, title: titleStr });
  };

  const confirmDeleteAnnouncement = async () => {
    if (!announcementToDelete) return;
    playClickTick();
    const { id, title } = announcementToDelete;
    setAnnouncementToDelete(null);
    const res = await deleteAnnouncementInDB(id);
    if (res.success) {
      playSuccessChime();
      onShowToast(`Announcement "${title}" deleted.`, 'info');
      loadAnnouncements();
    } else {
      playWarningBuzzer();
      onShowToast(res.error || 'Failed to delete announcement.', 'error');
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-slate-900/60 backdrop-blur-xs">
      <motion.div
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        exit={{ opacity: 0, scale: 0.95 }}
        className="bg-white border border-slate-200 rounded-3xl w-full max-w-3xl max-h-[90vh] flex flex-col shadow-2xl overflow-hidden"
      >
        {/* Header */}
        <div className="px-5 py-4 border-b border-slate-100 flex items-center justify-between gap-3 bg-slate-50/50">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-indigo-50 border border-indigo-200 text-indigo-700 flex items-center justify-center font-bold text-lg shadow-2xs">
              📢
            </div>
            <div>
              <h3 className="text-sm font-bold text-slate-900">Extracurricular Announcements &amp; Schedules</h3>
              <p className="text-xs text-slate-500">
                Official broadcasts and meeting notices displayed in real-time to all club members.
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 rounded-xl text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Toolbar */}
        <div className="px-5 py-3 border-b border-slate-100 flex items-center justify-between gap-3 bg-white text-xs">
          <span className="text-slate-500">Total Broadcasts: <strong className="text-slate-900 font-mono">{announcements.length}</strong></span>
          {canBroadcast ? (
            <button
              type="button"
              onClick={() => setShowCreate(!showCreate)}
              className="px-3 py-1.5 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white font-semibold transition cursor-pointer flex items-center gap-1.5 shadow-2xs"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>+ Create Announcement</span>
            </button>
          ) : (
            <div className="flex items-center gap-1.5 px-3 py-1 rounded-xl bg-slate-100 border border-slate-200 text-slate-500 text-[11px] font-medium">
              <Lock className="w-3 h-3 text-slate-400" />
              <span>Broadcasts by Admin &amp; Executive Board Only (Read-Only)</span>
            </div>
          )}
        </div>

        {/* Content Body */}
        <div className="p-5 overflow-y-auto flex-1 space-y-4">
          {/* Create Form */}
          <AnimatePresence>
            {showCreate && (
              <motion.form
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: 'auto' }}
                exit={{ opacity: 0, height: 0 }}
                onSubmit={handleCreateAnnouncement}
                className="p-5 bg-indigo-50/40 border border-indigo-200 rounded-2xl space-y-3.5 text-xs mb-4"
              >
                <div className="font-bold text-indigo-950 flex items-center justify-between">
                  <span>Create &amp; Broadcast Announcement</span>
                  <button type="button" onClick={() => setShowCreate(false)} className="text-slate-400 hover:text-slate-600 cursor-pointer">×</button>
                </div>

                <div>
                  <label className="block text-[11px] font-semibold text-slate-700 mb-1">
                    Announcement Title <span className="text-rose-500">*</span>
                  </label>
                  <input
                    type="text"
                    required
                    value={title}
                    onChange={(e) => setTitle(e.target.value)}
                    placeholder="e.g., National Robotics Contest 2026 Preparation Schedule"
                    className="w-full px-3 py-2 bg-white border border-slate-200 rounded-xl text-xs"
                  />
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="block text-[11px] font-semibold text-slate-700 mb-1">Meeting Location</label>
                    <input
                      type="text"
                      value={location}
                      onChange={(e) => setLocation(e.target.value)}
                      placeholder="Lab Robotika MAN 2 Kota Bekasi"
                      className="w-full px-3 py-2 bg-white border border-slate-200 rounded-xl text-xs"
                    />
                  </div>
                  <div>
                    <label className="block text-[11px] font-semibold text-slate-700 mb-1">Date &amp; Time (Optional)</label>
                    <input
                      type="datetime-local"
                      value={eventDate}
                      onChange={(e) => setEventDate(e.target.value)}
                      className="w-full px-3 py-2 bg-white border border-slate-200 rounded-xl text-xs font-mono"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-[11px] font-semibold text-slate-700 mb-1">
                    Announcement Body Content <span className="text-rose-500">*</span>
                  </label>
                  <textarea
                    rows={4}
                    required
                    value={content}
                    onChange={(e) => setContent(e.target.value)}
                    placeholder="Write detailed information, agendas, requirements, or materials students must bring..."
                    className="w-full px-3 py-2 bg-white border border-slate-200 rounded-xl text-xs"
                  />
                </div>

                <div className="flex justify-end gap-2 pt-2">
                  <button
                    type="button"
                    onClick={() => setShowCreate(false)}
                    className="px-3 py-1.5 text-slate-600 hover:bg-slate-100 rounded-lg cursor-pointer"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={isSubmitting}
                    className="px-4 py-1.5 bg-indigo-600 hover:bg-indigo-700 text-white font-bold rounded-xl text-xs shadow-2xs cursor-pointer flex items-center gap-1.5"
                  >
                    {isSubmitting ? 'Broadcasting...' : 'Broadcast Now'}
                  </button>
                </div>
              </motion.form>
            )}
          </AnimatePresence>

          {/* List */}
          <div className="space-y-3">
            {isLoading ? (
              <div className="py-8 text-center text-slate-400 text-xs">
                <span className="inline-block w-4 h-4 border-2 border-indigo-600 border-t-transparent rounded-full animate-spin mr-2" />
                Loading announcements...
              </div>
            ) : announcements.length === 0 ? (
              <div className="bg-slate-50 border border-slate-200 rounded-2xl p-8 text-center space-y-2">
                <Bell className="w-8 h-8 text-slate-300 mx-auto" />
                <p className="text-xs font-semibold text-slate-700">No announcements published yet</p>
                <p className="text-[11px] text-slate-400">Click "+ Create Announcement" to broadcast news to all members.</p>
              </div>
            ) : (
              announcements.map((item) => (
                <div
                  key={item.id}
                  className="p-4 bg-white border border-slate-200/90 rounded-2xl shadow-2xs space-y-2 flex flex-col justify-between"
                >
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <div className="flex items-center gap-2 mb-1">
                        <span className="px-2 py-0.5 rounded-md bg-indigo-50 text-indigo-700 font-bold text-[10px]">
                          OFFICIAL ANNOUNCEMENT
                        </span>
                        <span className="text-[10px] text-slate-400">
                          {new Date(item.created_at).toLocaleDateString('en-US', { day: 'numeric', month: 'long', year: 'numeric' })}
                        </span>
                      </div>
                      <h4 className="text-sm font-bold text-slate-900">{item.title}</h4>
                      <p className="text-xs text-slate-600 leading-relaxed whitespace-pre-line mt-1">{item.content}</p>
                    </div>

                    {canBroadcast && (
                      <button
                        type="button"
                        onClick={() => handleDeleteAnnouncement(item.id, item.title)}
                        className="p-1 rounded-lg text-slate-400 hover:text-rose-600 hover:bg-rose-50 transition cursor-pointer shrink-0"
                        title="Delete Announcement"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    )}
                  </div>

                  <div className="pt-2 border-t border-slate-100 flex items-center justify-between text-[11px] text-slate-400">
                    <div className="flex items-center gap-1.5">
                      <MapPin className="w-3.5 h-3.5 text-slate-400" />
                      <span>{item.location || 'Lab Robotika MAN 2 Kota Bekasi'}</span>
                    </div>
                    <span>Published by: <strong className="text-slate-700">{item.author_name}</strong></span>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>

        {/* Footer */}
        <div className="px-5 py-3 border-t border-slate-100 bg-slate-50 flex items-center justify-end text-xs">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-1.5 rounded-xl bg-slate-200 hover:bg-slate-300 text-slate-800 font-semibold cursor-pointer"
          >
            Close
          </button>
        </div>

        {/* Delete Confirmation Dialog */}
        <AnimatePresence>
          {announcementToDelete && (
            <div className="fixed inset-0 z-60 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs">
              <motion.div
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.95 }}
                className="bg-white rounded-2xl p-5 border border-slate-200 shadow-2xl max-w-sm w-full space-y-3.5 text-center"
              >
                <div className="w-11 h-11 rounded-2xl bg-rose-50 text-rose-600 border border-rose-100 flex items-center justify-center mx-auto">
                  <Trash2 className="w-5 h-5" />
                </div>
                <div>
                  <h4 className="text-sm font-bold text-slate-900">Delete Announcement</h4>
                  <p className="text-xs text-slate-500 mt-1">
                    Are you sure you want to delete announcement <strong>"{announcementToDelete.title}"</strong>?
                  </p>
                </div>
                <div className="flex gap-2 pt-1">
                  <button
                    type="button"
                    onClick={() => setAnnouncementToDelete(null)}
                    className="flex-1 py-2 px-3 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-semibold transition cursor-pointer"
                  >
                    Cancel
                  </button>
                  <button
                    type="button"
                    onClick={confirmDeleteAnnouncement}
                    className="flex-1 py-2 px-3 rounded-xl bg-rose-600 hover:bg-rose-700 text-white text-xs font-bold shadow-md shadow-rose-600/20 transition cursor-pointer"
                  >
                    Delete
                  </button>
                </div>
              </motion.div>
            </div>
          )}
        </AnimatePresence>
      </motion.div>
    </div>
  );
};
