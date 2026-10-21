import React, { useState, useEffect, useMemo } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  BookOpen, 
  Plus, 
  Search, 
  Filter, 
  CheckCircle2, 
  AlertTriangle, 
  Clock, 
  Award, 
  ExternalLink, 
  FileText, 
  Send, 
  Edit3, 
  UserCheck, 
  UserX, 
  Users, 
  Sparkles, 
  RefreshCw, 
  Trash2, 
  Calendar, 
  AlertCircle,
  X,
  ChevronDown,
  Megaphone,
  Check,
  ShieldCheck,
  Layers
} from 'lucide-react';
import { MaterialAssignment, AssignmentSubmission, Member, UserSession } from '../types';
import { 
  fetchMaterialsAssignmentsFromDB, 
  createMaterialAssignmentInDB, 
  deleteMaterialAssignmentInDB,
  fetchSubmissionsByAssignmentFromDB, 
  gradeSubmissionInDB, 
  recordDirectGradeInDB 
} from '../services/supabaseService';
import { playClickTick, playSuccessChime, playWarningBuzzer } from '../utils/audioFeedback';
import { INITIAL_ASSIGNMENTS } from '../data/initialData';
import { isSafeWebUrl } from '../utils/assignmentAttachment';

interface AdminTasksGradingViewProps {
  members: Member[];
  session: UserSession | null;
  onShowToast: (msg: string, type: 'success' | 'error' | 'info') => void;
  onAssignmentsCountChange?: (count: number) => void;
}

export const AdminTasksGradingView: React.FC<AdminTasksGradingViewProps> = ({
  members,
  session,
  onShowToast,
  onAssignmentsCountChange,
}) => {
  const [materials, setMaterials] = useState<MaterialAssignment[]>([]);
  const [selectedAssignmentId, setSelectedAssignmentId] = useState<string>('all');
  const [submissions, setSubmissions] = useState<AssignmentSubmission[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [statusFilter, setStatusFilter] = useState<'all' | 'unsubmitted' | 'pending' | 'graded'>('all');
  const [classFilter, setClassFilter] = useState<string>('all');

  // Modal states
  const [isCreateModalOpen, setIsCreateModalOpen] = useState<boolean>(false);
  const [taskToDelete, setTaskToDelete] = useState<{ id: string; title: string } | null>(null);
  const [gradingTarget, setGradingTarget] = useState<{
    member: Member;
    assignment: MaterialAssignment;
    submission?: AssignmentSubmission;
  } | null>(null);

  // Form states for grading
  const [gradeScore, setGradeScore] = useState<number>(85);
  const [gradeStatus, setGradeStatus] = useState<'passed' | 'revision'>('passed');
  const [gradeFeedback, setGradeFeedback] = useState<string>('');
  const [isSavingGrade, setIsSavingGrade] = useState<boolean>(false);

  // Form state for creating new assignment
  const [newTitle, setNewTitle] = useState('');
  const [newModuleCategory, setNewModuleCategory] = useState('IoT & Sensor Arduino');
  const [newDescription, setNewDescription] = useState('');
  const [newDueDate, setNewDueDate] = useState('');
  const [newPassingGrade, setNewPassingGrade] = useState(75);
  const [isCreating, setIsCreating] = useState(false);

  // Helper getters for member properties
  const getMemberName = (m: Member): string => {
    return (m.fullName || (m as any).name || (m as any).full_name || 'Student').trim();
  };

  const getMemberId = (m: Member): string => {
    return String(m.id_member || (m as any).id || m.nisn || '');
  };

  const getMemberClass = (m: Member): string => {
    if (m.kelas) return m.kelas.trim();
    if (m.grade && m.classRoom) return `${m.grade}-${m.classRoom}`;
    return 'X';
  };

  // Load all materials & assignments
  const loadData = async () => {
    setIsLoading(true);
    try {
      const mats = await fetchMaterialsAssignmentsFromDB();
      const resolvedMats = (mats && mats.length > 0) ? mats : (INITIAL_ASSIGNMENTS as MaterialAssignment[]);
      setMaterials(resolvedMats);
      
      const count = resolvedMats.filter(m => m.type === 'assignment').length;
      onAssignmentsCountChange?.(count);
      try {
        window.dispatchEvent(new CustomEvent('robotics_assignments_updated', { detail: { count } }));
      } catch {}
      
      // Collect submissions across assignments
      let allSubs: AssignmentSubmission[] = [];
      const assignmentsOnly = resolvedMats.filter(m => m.type === 'assignment');
      
      for (const assign of assignmentsOnly) {
        try {
          const subs = await fetchSubmissionsByAssignmentFromDB(assign.id);
          allSubs.push(...subs);
        } catch (e) {
          console.warn('Error fetching submissions for', assign.id, e);
        }
      }

      // Scan localStorage for cached submissions
      try {
        for (let i = 0; i < localStorage.length; i++) {
          const key = localStorage.key(i);
          if (key && key.startsWith('robotics_subs_')) {
            const raw = localStorage.getItem(key);
            if (raw) {
              const parsed = JSON.parse(raw);
              if (Array.isArray(parsed)) {
                for (const item of parsed) {
                  if (item && item.id && !allSubs.some(s => s.id === item.id)) {
                    allSubs.push(item);
                  }
                }
              }
            }
          }
        }
      } catch (e) {
        console.warn('Local storage scan error:', e);
      }

      setSubmissions(allSubs);
    } catch (err) {
      console.error('Error loading materials & assignments:', err);
      onShowToast('Failed to load assignments and tasks', 'error');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadData();
    const handleGradeUpdated = () => {
      loadData();
    };
    window.addEventListener('robotics_grade_updated', handleGradeUpdated);
    return () => window.removeEventListener('robotics_grade_updated', handleGradeUpdated);
  }, []);

  // Filter materials that are assignments
  const assignmentsList = useMemo(() => {
    return materials.filter(m => m.type === 'assignment');
  }, [materials]);

  // Selected assignment object
  const activeAssignment = useMemo(() => {
    if (selectedAssignmentId === 'all') {
      return assignmentsList[0] || null;
    }
    return assignmentsList.find(a => a.id === selectedAssignmentId) || assignmentsList[0] || null;
  }, [selectedAssignmentId, assignmentsList]);

  // Unique classes for filter
  const classOptions = useMemo(() => {
    const set = new Set<string>();
    members.forEach(m => {
      const c = getMemberClass(m);
      if (c) set.add(c);
    });
    return Array.from(set).sort();
  }, [members]);

  // Roster status matrix for activeAssignment
  const rosterData = useMemo(() => {
    if (!activeAssignment) return [];

    return members.map(m => {
      const mId = getMemberId(m).toLowerCase();
      const mNisn = String(m.nisn || '').trim().toLowerCase();
      const mName = getMemberName(m).toLowerCase();

      const sub = submissions.find(s => {
        if (s.assignment_id !== activeAssignment.id && (s as any).material_id !== activeAssignment.id) return false;
        const sStudentId = String(s.student_id || '').trim().toLowerCase();
        const sStudentName = String(s.student_name || '').trim().toLowerCase();
        return (
          (mId && sStudentId === mId) ||
          (mNisn && sStudentId === mNisn) ||
          (mName && sStudentName === mName) ||
          (mNisn && (s as any).student_nisn && (s as any).student_nisn.trim().toLowerCase() === mNisn)
        );
      });

      const hasSubmitted = !!sub;
      const isGraded = hasSubmitted && (sub.status === 'graded' || typeof sub.score_numeric === 'number');

      return {
        member: m,
        assignment: activeAssignment,
        submission: sub,
        hasSubmitted,
        isGraded
      };
    });
  }, [members, activeAssignment, submissions]);

  // Filtered Roster based on search and status
  const filteredRoster = useMemo(() => {
    return rosterData.filter(item => {
      const name = getMemberName(item.member).toLowerCase();
      const nisn = String(item.member.nisn || '').toLowerCase();
      const kelas = getMemberClass(item.member).toLowerCase();
      const q = searchQuery.toLowerCase().trim();

      const matchSearch = !q || name.includes(q) || nisn.includes(q) || kelas.includes(q);
      if (!matchSearch) return false;

      // Class filter
      if (classFilter !== 'all' && getMemberClass(item.member) !== classFilter) {
        return false;
      }

      // Status filter
      if (statusFilter === 'unsubmitted') {
        return !item.hasSubmitted;
      }
      if (statusFilter === 'pending') {
        return item.hasSubmitted && !item.isGraded;
      }
      if (statusFilter === 'graded') {
        return item.isGraded;
      }

      return true;
    });
  }, [rosterData, searchQuery, classFilter, statusFilter]);

  // KPI Metrics
  const totalStudents = members.length;
  const submittedCount = rosterData.filter(r => r.hasSubmitted).length;
  const unsubmittedCount = rosterData.filter(r => !r.hasSubmitted).length;
  const gradedCount = rosterData.filter(r => r.isGraded).length;
  const pendingCount = rosterData.filter(r => r.hasSubmitted && !r.isGraded).length;
  const completionRate = totalStudents > 0 ? Math.round((submittedCount / totalStudents) * 100) : 0;

  // Open grading modal for a student
  const handleOpenGradeModal = (item: typeof rosterData[0]) => {
    playClickTick();
    setGradingTarget({
      member: item.member,
      assignment: item.assignment,
      submission: item.submission
    });
    if (item.submission && typeof item.submission.score_numeric === 'number') {
      setGradeScore(item.submission.score_numeric);
      setGradeFeedback(item.submission.feedback || (item.submission as any).feedback_notes || '');
      setGradeStatus(item.submission.score_numeric >= ((item.assignment as any).passing_score || 75) ? 'passed' : 'revision');
    } else {
      setGradeScore(85);
      setGradeFeedback('Great practical robotics work! Circuit is wired properly and logic operates as expected.');
      setGradeStatus('passed');
    }
  };

  // Submit Grade
  const handleSaveGrade = async () => {
    if (!gradingTarget) return;
    setIsSavingGrade(true);
    playClickTick();

    const evaluatorName = session?.name || session?.username || 'Club Administrator';
    const studentName = getMemberName(gradingTarget.member);
    const studentId = getMemberId(gradingTarget.member);

    try {
      if (gradingTarget.submission && gradingTarget.submission.id) {
        // Update existing submission
        await gradeSubmissionInDB(
          gradingTarget.submission.id,
          {
            score_numeric: gradeScore,
            score_binary: gradeStatus === 'passed' ? 'Pass' : 'Needs Improvement',
            graded_by: evaluatorName,
            feedback: gradeFeedback
          }
        );
      } else {
        // Direct grade
        await recordDirectGradeInDB({
          assignment_id: gradingTarget.assignment.id,
          student_id: studentId,
          student_name: studentName,
          student_email: gradingTarget.member.email || '',
          score_numeric: gradeScore,
          score_binary: gradeStatus === 'passed' ? 'Pass' : 'Needs Improvement',
          feedback: gradeFeedback,
          graded_by: evaluatorName
        });
      }

      playSuccessChime();
      onShowToast(session?.isDemo ? `[Demo Sandbox] Grade recorded for ${studentName} in isolated sandbox!` : `Grade successfully recorded and published for ${studentName}!`, 'success');
      setGradingTarget(null);
      await loadData();
    } catch (err) {
      console.error('Error saving grade:', err);
      onShowToast('Failed to save grade. Please try again.', 'error');
    } finally {
      setIsSavingGrade(false);
    }
  };

  // Send Reminder to Unsubmitted Student
  const handleSendReminder = (studentName: string) => {
    playClickTick();
    const reminderMsg = `Task Reminder: "${activeAssignment?.title || 'Robotics Challenge'}" has not been turned in yet by ${studentName}. Please submit your solution before the deadline!`;
    
    try {
      const existingAlerts = JSON.parse(localStorage.getItem('robotics_grade_announcements') || '[]');
      existingAlerts.unshift({
        id: `rem_${Date.now()}`,
        type: 'reminder',
        title: `Task Reminder: ${activeAssignment?.title}`,
        message: reminderMsg,
        timestamp: new Date().toISOString()
      });
      localStorage.setItem('robotics_grade_announcements', JSON.stringify(existingAlerts.slice(0, 30)));
    } catch {}

    playSuccessChime();
    onShowToast(`Task reminder sent to ${studentName}!`, 'info');
  };

  // Send Bulk Reminder
  const handleSendBulkReminder = () => {
    if (unsubmittedCount === 0) {
      onShowToast('All students have already completed this task!', 'info');
      return;
    }
    playClickTick();
    try {
      const existingAlerts = JSON.parse(localStorage.getItem('robotics_grade_announcements') || '[]');
      existingAlerts.unshift({
        id: `bulk_${Date.now()}`,
        type: 'bulk_reminder',
        title: `Task Reminder: ${activeAssignment?.title}`,
        message: `Notice to ${unsubmittedCount} students who have not yet submitted "${activeAssignment?.title}". Please submit via the student portal!`,
        timestamp: new Date().toISOString()
      });
      localStorage.setItem('robotics_grade_announcements', JSON.stringify(existingAlerts.slice(0, 30)));
    } catch {}

    playSuccessChime();
    onShowToast(`Bulk reminder sent to ${unsubmittedCount} unsubmitted students!`, 'success');
  };

  // Delete Assignment Trigger
  const handleDeleteAssignment = (assignmentId: string, titleStr: string) => {
    playClickTick();
    setTaskToDelete({ id: assignmentId, title: titleStr });
  };

  const confirmDeleteTask = async () => {
    if (!taskToDelete) return;
    playClickTick();
    const { id: assignmentId, title: titleStr } = taskToDelete;
    setTaskToDelete(null);
    try {
      const res = await deleteMaterialAssignmentInDB(assignmentId);
      if (res.success) {
        playSuccessChime();
        onShowToast(session?.isDemo ? `[Demo Sandbox] Task "${titleStr}" deleted in isolated sandbox.` : `Task "${titleStr}" deleted successfully.`, 'info');
        setSelectedAssignmentId('all');
        await loadData();
      } else {
        throw new Error(res.error || 'Failed to delete assignment');
      }
    } catch (err: any) {
      console.error('Delete error:', err);
      onShowToast(err.message || 'Failed to delete task.', 'error');
    }
  };

  // Create Assignment
  const handleCreateAssignment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newTitle.trim()) {
      onShowToast('Task title is required!', 'error');
      return;
    }

    setIsCreating(true);
    playClickTick();

    try {
      const res = await createMaterialAssignmentInDB({
        title: newTitle.trim(),
        description: (newModuleCategory ? `[${newModuleCategory}] ` : '') + (newDescription.trim() || 'Complete the practical robotics challenge according to guidelines.'),
        type: 'assignment',
        deadline: newDueDate || undefined,
        grading_type: 'numeric',
        max_score: 100,
        created_by: session?.name || session?.username || 'Admin'
      });

      if (res.success && res.data) {
        playSuccessChime();
        onShowToast(session?.isDemo ? `[Demo Sandbox] Task "${res.data.title}" created in isolated sandbox!` : `Task "${res.data.title}" created successfully!`, 'success');
        setIsCreateModalOpen(false);
        setNewTitle('');
        setNewDescription('');
        setNewDueDate('');
        await loadData();
        setSelectedAssignmentId(res.data.id);
      } else {
        throw new Error(res.error || 'Failed to create assignment');
      }
    } catch (err) {
      console.error('Error creating assignment:', err);
      onShowToast('Failed to create new task.', 'error');
    } finally {
      setIsCreating(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* ========================================================================= */}
      {/* 1. Header Bar: Title, Action Buttons & Quick Selector */}
      {/* ========================================================================= */}
      <div className="bg-white rounded-3xl border border-slate-200/90 p-5 sm:p-6 shadow-sm flex flex-col lg:flex-row lg:items-center justify-between gap-4">
        <div className="space-y-1">
          <div className="flex flex-wrap items-center gap-2">
            <span className="px-2.5 py-0.5 rounded-full bg-blue-50 text-blue-700 border border-blue-200 text-[10px] font-extrabold uppercase tracking-wider flex items-center gap-1">
              <ShieldCheck className="w-3 h-3 text-blue-600" />
              <span>Admin &amp; Executive Hub</span>
            </span>
            <span className="text-xs text-slate-400 font-medium">
              MAN 2 Kota Bekasi Robotics Club • Academic Year 2026/2027
            </span>
          </div>

          <h2 className="text-xl sm:text-2xl font-black text-slate-900 tracking-tight flex items-center gap-2">
            <BookOpen className="w-6 h-6 text-blue-600" />
            <span>Tasks &amp; Student Grading Center</span>
          </h2>

          <p className="text-xs sm:text-sm text-slate-500 leading-relaxed max-w-2xl">
            Track student submissions, review project code/schematic links, evaluate practical laboratory challenges, 
            and publish official grades directly to student portals in real time.
          </p>
        </div>

        {/* Action Controls */}
        <div className="flex flex-wrap items-center gap-2.5 shrink-0">
          <button
            type="button"
            onClick={loadData}
            disabled={isLoading}
            className="flex items-center gap-1.5 px-3 py-2 rounded-xl border border-slate-200 bg-white hover:bg-slate-50 text-slate-700 text-xs font-bold transition cursor-pointer shadow-2xs"
            title="Refresh task submissions"
          >
            <RefreshCw className={`w-3.5 h-3.5 text-slate-500 ${isLoading ? 'animate-spin' : ''}`} />
            <span>Refresh</span>
          </button>

          <button
            type="button"
            onClick={() => {
              playClickTick();
              setIsCreateModalOpen(true);
            }}
            className="flex items-center gap-1.5 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold rounded-xl transition cursor-pointer shadow-xs active:scale-95"
          >
            <Plus className="w-4 h-4" />
            <span>+ Create New Task</span>
          </button>
        </div>
      </div>

      {/* ========================================================================= */}
      {/* 2. Assignment Switcher Bar */}
      {/* ========================================================================= */}
      <div className="bg-white rounded-2xl border border-slate-200/90 p-4 shadow-2xs flex flex-col md:flex-row md:items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <Layers className="w-4 h-4 text-blue-600" />
          <span className="text-xs font-bold text-slate-700">Select Active Task:</span>
        </div>

        <div className="flex flex-wrap items-center gap-2 flex-1 md:justify-end">
          {assignmentsList.length === 0 ? (
            <span className="text-xs text-slate-400 italic">No tasks created yet. Click "+ Create New Task" above.</span>
          ) : (
            assignmentsList.map(a => {
              const isSelected = (activeAssignment?.id === a.id);
              return (
                <button
                  key={a.id}
                  type="button"
                  onClick={() => {
                    playClickTick();
                    setSelectedAssignmentId(a.id);
                  }}
                  className={`px-3 py-1.5 rounded-xl text-xs font-bold transition cursor-pointer shrink-0 border ${
                    isSelected
                      ? 'bg-blue-600 text-white border-blue-600 shadow-2xs'
                      : 'bg-slate-50 hover:bg-slate-100 text-slate-700 border-slate-200'
                  }`}
                >
                  {a.title}
                </button>
              );
            })
          )}
        </div>
      </div>

      {/* ========================================================================= */}
      {/* 3. Task Overview KPI Cards */}
      {/* ========================================================================= */}
      {activeAssignment ? (
        <div className="space-y-4">
          {/* Active Task Banner */}
          <div className="bg-gradient-to-r from-slate-900 via-blue-950 to-indigo-950 text-white p-5 rounded-3xl shadow-md border border-slate-800 flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div className="space-y-1">
              <div className="flex items-center gap-2">
                <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-blue-500/30 text-blue-200 border border-blue-400/30 uppercase tracking-wider">
                  Active Challenge
                </span>
                {activeAssignment.deadline && (
                  <span className="text-xs text-slate-300 font-mono flex items-center gap-1">
                    <Clock className="w-3 h-3 text-slate-400" />
                    <span>Due: {new Date(activeAssignment.deadline).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}</span>
                  </span>
                )}
              </div>
              <h3 className="text-lg font-bold text-white">{activeAssignment.title}</h3>
              <p className="text-xs text-slate-300 max-w-2xl line-clamp-2">{activeAssignment.description}</p>
            </div>

            <div className="flex items-center gap-2 shrink-0">
              <button
                type="button"
                onClick={handleSendBulkReminder}
                disabled={unsubmittedCount === 0}
                className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-amber-500 hover:bg-amber-600 disabled:opacity-40 text-slate-950 font-bold text-xs transition cursor-pointer shadow-xs"
                title="Send reminder to students with pending submissions"
              >
                <Megaphone className="w-3.5 h-3.5" />
                <span>Remind Pending ({unsubmittedCount})</span>
              </button>

              <button
                type="button"
                onClick={() => handleDeleteAssignment(activeAssignment.id, activeAssignment.title)}
                className="p-2 rounded-xl bg-rose-500/20 hover:bg-rose-500/30 border border-rose-400/30 text-rose-200 transition cursor-pointer"
                title="Delete this task"
              >
                <Trash2 className="w-4 h-4" />
              </button>
            </div>
          </div>

          {/* Metrics Grid */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
            <div 
              onClick={() => setStatusFilter('all')}
              className={`bg-white border rounded-2xl p-4 shadow-2xs space-y-1 cursor-pointer transition ${
                statusFilter === 'all' ? 'border-slate-800 ring-2 ring-slate-400' : 'border-slate-200 hover:border-slate-300'
              }`}
            >
              <div className="flex items-center justify-between text-slate-500">
                <span className="text-[11px] font-bold uppercase tracking-wider">Enrolled Students</span>
                <Users className="w-4 h-4 text-slate-400" />
              </div>
              <p className="text-2xl font-black text-slate-900 font-mono">{totalStudents}</p>
              <p className="text-[11px] text-slate-500 font-medium">Club Roster Total</p>
            </div>

            <div 
              onClick={() => setStatusFilter('unsubmitted')}
              className={`bg-rose-50/70 border rounded-2xl p-4 shadow-2xs space-y-1 cursor-pointer transition ${
                statusFilter === 'unsubmitted' ? 'border-rose-500 ring-2 ring-rose-200' : 'border-rose-200/80 hover:border-rose-300'
              }`}
            >
              <div className="flex items-center justify-between text-rose-800">
                <span className="text-[11px] font-bold uppercase tracking-wider">Pending Submission</span>
                <UserX className="w-4 h-4 text-rose-600" />
              </div>
              <p className="text-2xl font-black text-rose-700 font-mono">{unsubmittedCount}</p>
              <p className="text-[11px] text-rose-600 font-bold">{unsubmittedCount > 0 ? 'Action required' : 'All submitted'}</p>
            </div>

            <div 
              onClick={() => setStatusFilter('pending')}
              className={`bg-blue-50/70 border rounded-2xl p-4 shadow-2xs space-y-1 cursor-pointer transition ${
                statusFilter === 'pending' ? 'border-blue-500 ring-2 ring-blue-200' : 'border-blue-200/80 hover:border-blue-300'
              }`}
            >
              <div className="flex items-center justify-between text-blue-800">
                <span className="text-[11px] font-bold uppercase tracking-wider">Awaiting Evaluation</span>
                <Clock className="w-4 h-4 text-blue-600" />
              </div>
              <p className="text-2xl font-black text-blue-700 font-mono">{pendingCount}</p>
              <p className="text-[11px] text-blue-600 font-medium">Ready for grading</p>
            </div>

            <div 
              onClick={() => setStatusFilter('graded')}
              className={`bg-emerald-50/70 border rounded-2xl p-4 shadow-2xs space-y-1 cursor-pointer transition ${
                statusFilter === 'graded' ? 'border-emerald-500 ring-2 ring-emerald-200' : 'border-emerald-200/80 hover:border-emerald-300'
              }`}
            >
              <div className="flex items-center justify-between text-emerald-800">
                <span className="text-[11px] font-bold uppercase tracking-wider">Graded</span>
                <UserCheck className="w-4 h-4 text-emerald-600" />
              </div>
              <p className="text-2xl font-black text-emerald-700 font-mono">{gradedCount}</p>
              <p className="text-[11px] text-emerald-600 font-medium">{completionRate}% Completion Rate</p>
            </div>
          </div>
        </div>
      ) : (
        <div className="p-8 text-center bg-white rounded-3xl border border-dashed border-slate-300 space-y-3">
          <BookOpen className="w-10 h-10 text-slate-400 mx-auto" />
          <h3 className="text-base font-bold text-slate-800">No Active Tasks</h3>
          <p className="text-xs text-slate-500 max-w-md mx-auto">
            Click "+ Create New Task" above to publish your first robotics workshop challenge.
          </p>
        </div>
      )}

      {/* ========================================================================= */}
      {/* 4. Filter Toolbar & Search Bar */}
      {/* ========================================================================= */}
      <div className="bg-white rounded-2xl border border-slate-200/90 p-4 shadow-2xs space-y-3">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
          {/* Status Tabs */}
          <div className="flex items-center gap-1.5 overflow-x-auto pb-1 sm:pb-0 scrollbar-none">
            <button
              type="button"
              onClick={() => {
                playClickTick();
                setStatusFilter('all');
              }}
              className={`px-3 py-1.5 rounded-xl text-xs font-bold transition cursor-pointer shrink-0 ${
                statusFilter === 'all'
                  ? 'bg-slate-900 text-white shadow-xs'
                  : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
              }`}
            >
              All Students ({rosterData.length})
            </button>

            <button
              type="button"
              onClick={() => {
                playClickTick();
                setStatusFilter('unsubmitted');
              }}
              className={`px-3 py-1.5 rounded-xl text-xs font-bold transition cursor-pointer shrink-0 flex items-center gap-1.5 ${
                statusFilter === 'unsubmitted'
                  ? 'bg-rose-600 text-white shadow-xs'
                  : 'bg-rose-50 text-rose-700 hover:bg-rose-100 border border-rose-200/60'
              }`}
            >
              <UserX className="w-3.5 h-3.5" />
              <span>Pending ({unsubmittedCount})</span>
            </button>

            <button
              type="button"
              onClick={() => {
                playClickTick();
                setStatusFilter('pending');
              }}
              className={`px-3 py-1.5 rounded-xl text-xs font-bold transition cursor-pointer shrink-0 flex items-center gap-1.5 ${
                statusFilter === 'pending'
                  ? 'bg-blue-600 text-white shadow-xs'
                  : 'bg-blue-50 text-blue-700 hover:bg-blue-100 border border-blue-200/60'
              }`}
            >
              <Clock className="w-3.5 h-3.5" />
              <span>Awaiting Grade ({pendingCount})</span>
            </button>

            <button
              type="button"
              onClick={() => {
                playClickTick();
                setStatusFilter('graded');
              }}
              className={`px-3 py-1.5 rounded-xl text-xs font-bold transition cursor-pointer shrink-0 flex items-center gap-1.5 ${
                statusFilter === 'graded'
                  ? 'bg-emerald-600 text-white shadow-xs'
                  : 'bg-emerald-50 text-emerald-700 hover:bg-emerald-100 border border-emerald-200/60'
              }`}
            >
              <UserCheck className="w-3.5 h-3.5" />
              <span>Graded ({gradedCount})</span>
            </button>
          </div>

          {/* Search & Class Dropdown */}
          <div className="flex items-center gap-2">
            <div className="relative flex-1 sm:w-60">
              <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                placeholder="Search student or NISN..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-9 pr-3 py-1.5 rounded-xl border border-slate-200 text-xs focus:outline-none focus:ring-2 focus:ring-blue-500 bg-slate-50"
              />
              {searchQuery && (
                <button
                  type="button"
                  onClick={() => setSearchQuery('')}
                  className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              )}
            </div>

            <select
              value={classFilter}
              onChange={(e) => setClassFilter(e.target.value)}
              className="py-1.5 px-3 rounded-xl border border-slate-200 text-xs bg-slate-50 text-slate-700 font-medium focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="all">All Classes</option>
              {classOptions.map(cls => (
                <option key={cls} value={cls}>{cls}</option>
              ))}
            </select>
          </div>
        </div>
      </div>

      {/* ========================================================================= */}
      {/* 5. Student Roster Grading Table / List */}
      {/* ========================================================================= */}
      <div className="bg-white rounded-3xl border border-slate-200/90 shadow-sm overflow-hidden">
        <div className="p-4 sm:p-5 border-b border-slate-200/90 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <h3 className="text-sm font-black text-slate-900 tracking-tight">
              Student Roster &amp; Submission Status
            </h3>
            <span className="px-2 py-0.5 rounded-md bg-slate-100 text-slate-600 font-mono font-bold text-[11px]">
              {filteredRoster.length} Students Displayed
            </span>
          </div>

          <span className="text-xs text-slate-500 hidden sm:inline">
            Active Task: <strong>{activeAssignment?.title || '-'}</strong>
          </span>
        </div>

        {filteredRoster.length === 0 ? (
          <div className="p-10 text-center space-y-2">
            <Users className="w-8 h-8 text-slate-400 mx-auto" />
            <p className="text-sm font-bold text-slate-700">No students match the current filter</p>
            <p className="text-xs text-slate-400">Try modifying your search term or switching the status filter above.</p>
          </div>
        ) : (
          <div className="divide-y divide-slate-100">
            {filteredRoster.map((item) => {
              const { member, submission, hasSubmitted, isGraded } = item;
              const studentName = getMemberName(member);
              const studentClass = getMemberClass(member);
              const studentId = getMemberId(member);

              return (
                <div 
                  key={studentId || studentName}
                  className="p-4 sm:p-5 flex flex-col md:flex-row md:items-center justify-between gap-4 hover:bg-slate-50/80 transition"
                >
                  {/* Left: Member Identity */}
                  <div className="flex items-start sm:items-center gap-3.5 min-w-0">
                    <div className="w-10 h-10 rounded-2xl bg-gradient-to-tr from-blue-700 to-indigo-600 text-white flex items-center justify-center font-bold text-sm shadow-2xs shrink-0">
                      {studentName.charAt(0).toUpperCase()}
                    </div>

                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-2">
                        <h4 className="text-sm font-bold text-slate-900 truncate">
                          {studentName}
                        </h4>
                        <span className="px-2 py-0.5 rounded-md bg-slate-100 text-slate-600 font-mono font-bold text-[10px]">
                          {studentClass}
                        </span>
                        <span className="text-xs text-slate-400 font-mono">
                          NISN: {member.nisn || '-'}
                        </span>
                      </div>

                      {/* Status indicator row */}
                      <div className="flex flex-wrap items-center gap-2 mt-1">
                        {!hasSubmitted && (
                          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-rose-100 text-rose-800 border border-rose-200 text-[10px] font-extrabold uppercase tracking-wider">
                            <AlertTriangle className="w-3 h-3 text-rose-600" />
                            <span>Pending</span>
                          </span>
                        )}

                        {hasSubmitted && !isGraded && (
                          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-blue-100 text-blue-800 border border-blue-200 text-[10px] font-extrabold uppercase tracking-wider">
                            <Clock className="w-3 h-3 text-blue-600" />
                            <span>Submitted (Awaiting Grade)</span>
                          </span>
                        )}

                        {isGraded && (
                          <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-emerald-100 text-emerald-800 border border-emerald-200 text-[10px] font-extrabold uppercase tracking-wider">
                            <CheckCircle2 className="w-3 h-3 text-emerald-600" />
                            <span>Graded: {submission?.score_numeric ?? submission?.score_binary}/100</span>
                          </span>
                        )}

                        {(() => {
                          const targetUrl = submission?.submission_link || (submission as any)?.submission_url;
                          if (!targetUrl) return null;
                          if (!isSafeWebUrl(targetUrl)) {
                            return (
                              <span className="text-[10px] text-amber-700 font-mono bg-amber-50 px-2 py-0.5 rounded border border-amber-200">
                                ⚠️ Blocked Unsafe Protocol
                              </span>
                            );
                          }
                          return (
                            <a
                              href={targetUrl}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="inline-flex items-center gap-1 text-[11px] text-blue-600 hover:text-blue-800 hover:underline font-medium"
                            >
                              <ExternalLink className="w-3 h-3" />
                              <span>View Project Link</span>
                            </a>
                          );
                        })()}
                      </div>

                      {/* Evaluator notes preview if graded */}
                      {isGraded && (submission?.feedback || (submission as any)?.feedback_notes) && (
                        <p className="text-xs text-slate-500 italic mt-1 line-clamp-1">
                          Feedback: "{submission?.feedback || (submission as any)?.feedback_notes}"
                        </p>
                      )}
                    </div>
                  </div>

                  {/* Right: Actions */}
                  <div className="flex items-center gap-2 shrink-0 self-end md:self-center">
                    {!hasSubmitted && (
                      <>
                        <button
                          type="button"
                          onClick={() => handleSendReminder(studentName)}
                          className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl border border-amber-300 bg-amber-50 hover:bg-amber-100 text-amber-800 text-xs font-bold transition cursor-pointer"
                          title="Send task reminder"
                        >
                          <Send className="w-3 h-3 text-amber-600" />
                          <span>Remind</span>
                        </button>

                        <button
                          type="button"
                          onClick={() => handleOpenGradeModal(item)}
                          className="flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold transition cursor-pointer shadow-xs"
                          title="Assign direct practical grade"
                        >
                          <Award className="w-3.5 h-3.5" />
                          <span>Grade Directly</span>
                        </button>
                      </>
                    )}

                    {hasSubmitted && !isGraded && (
                      <button
                        type="button"
                        onClick={() => handleOpenGradeModal(item)}
                        className="flex items-center gap-1.5 px-4 py-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold transition cursor-pointer shadow-xs"
                      >
                        <Award className="w-3.5 h-3.5" />
                        <span>Grade &amp; Feedback</span>
                      </button>
                    )}

                    {isGraded && (
                      <button
                        type="button"
                        onClick={() => handleOpenGradeModal(item)}
                        className="flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl border border-slate-200 bg-white hover:bg-slate-100 text-slate-700 text-xs font-bold transition cursor-pointer"
                      >
                        <Edit3 className="w-3.5 h-3.5 text-blue-600" />
                        <span>Edit Score ({submission?.score_numeric}/100)</span>
                      </button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* ========================================================================= */}
      {/* 6. MODAL: Student Grading & Evaluation */}
      {/* ========================================================================= */}
      <AnimatePresence>
        {gradingTarget && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs">
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 10 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 10 }}
              className="bg-white rounded-3xl border border-slate-200 w-full max-w-lg overflow-hidden shadow-2xl relative"
            >
              {/* Header */}
              <div className="px-6 py-5 bg-gradient-to-r from-blue-700 to-indigo-700 text-white flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-2xl bg-white/20 text-white flex items-center justify-center font-bold">
                    <Award className="w-5 h-5 text-white" />
                  </div>
                  <div>
                    <h3 className="text-base font-bold text-white">
                      Student Grading &amp; Evaluation
                    </h3>
                    <p className="text-xs text-blue-100">
                      Official grade review and publication to student portal
                    </p>
                  </div>
                </div>

                <button
                  type="button"
                  onClick={() => setGradingTarget(null)}
                  className="p-1.5 rounded-xl bg-white/10 hover:bg-white/20 text-white transition cursor-pointer"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              {/* Body */}
              <div className="p-6 space-y-5 max-h-[75vh] overflow-y-auto">
                {/* Student Info Card */}
                <div className="p-3.5 rounded-2xl bg-slate-50 border border-slate-200 space-y-1">
                  <div className="flex items-center justify-between text-xs">
                    <span className="text-slate-500 font-medium">Student:</span>
                    <strong className="text-slate-900">{getMemberName(gradingTarget.member)}</strong>
                  </div>
                  <div className="flex items-center justify-between text-xs">
                    <span className="text-slate-500 font-medium">Class / NISN:</span>
                    <span className="font-mono text-slate-700">
                      {getMemberClass(gradingTarget.member)} • {gradingTarget.member.nisn || '-'}
                    </span>
                  </div>
                  <div className="flex items-center justify-between text-xs pt-1 border-t border-slate-200">
                    <span className="text-slate-500 font-medium">Practical Task:</span>
                    <strong className="text-blue-700">{gradingTarget.assignment.title}</strong>
                  </div>
                </div>

                {/* Student Submission Details: Link, Notes & File Attachment */}
                {gradingTarget.submission && (
                  <div className="p-3.5 rounded-2xl bg-blue-50/70 border border-blue-200/80 space-y-2.5 text-xs">
                    <div className="flex items-center justify-between font-bold text-blue-950">
                      <span className="flex items-center gap-1.5">
                        <FileText className="w-4 h-4 text-blue-600" />
                        <span>Submitted Work</span>
                      </span>
                      {gradingTarget.submission.submitted_at && (
                        <span className="text-[11px] font-normal text-blue-700">
                          {new Date(gradingTarget.submission.submitted_at).toLocaleString('id-ID', { dateStyle: 'medium', timeStyle: 'short' })}
                        </span>
                      )}
                    </div>

                    {/* 1. Project Link */}
                    {(() => {
                      const link = gradingTarget.submission.submission_link || (gradingTarget.submission as any).submission_url;
                      if (!link) return null;
                      if (!isSafeWebUrl(link)) {
                        return (
                          <div className="space-y-1">
                            <span className="text-[11px] font-semibold text-slate-600">Project / Source Link:</span>
                            <div className="text-xs text-amber-800 bg-amber-50 p-2.5 rounded-xl border border-amber-200 flex items-center gap-1.5 font-medium">
                              <span>⚠️ Unsafe URL protocol blocked (only https:// and http:// links are allowed).</span>
                            </div>
                          </div>
                        );
                      }
                      return (
                        <div className="space-y-1">
                          <span className="text-[11px] font-semibold text-slate-600">Project / Source Link:</span>
                          <a
                            href={link}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-blue-700 hover:text-blue-900 hover:underline flex items-center gap-1.5 font-mono break-all bg-white p-2 rounded-xl border border-blue-200/60"
                          >
                            <ExternalLink className="w-3.5 h-3.5 shrink-0 text-blue-600" />
                            <span className="truncate">{link}</span>
                          </a>
                        </div>
                      );
                    })()}

                    {/* 2. File Attachment */}
                    {gradingTarget.submission.file_name && (
                      <div className="space-y-1">
                        <span className="text-[11px] font-semibold text-slate-600">Attached File:</span>
                        <div className="flex items-center justify-between bg-white p-2 rounded-xl border border-blue-200/60">
                          <span className="font-mono text-slate-700 truncate max-w-xs">{gradingTarget.submission.file_name}</span>
                          {gradingTarget.submission.file_data && (
                            <a
                              href={gradingTarget.submission.file_data}
                              download={gradingTarget.submission.file_name}
                              className="text-xs font-bold text-blue-600 hover:text-blue-800 hover:underline shrink-0"
                            >
                              Download File
                            </a>
                          )}
                        </div>
                      </div>
                    )}

                    {/* 3. Student Notes / Description */}
                    {gradingTarget.submission.submission_text && (
                      <div className="space-y-1">
                        <span className="text-[11px] font-semibold text-slate-600">Student Notes:</span>
                        <p className="bg-white p-2.5 rounded-xl border border-blue-200/60 text-slate-700 italic leading-relaxed whitespace-pre-wrap">
                          "{gradingTarget.submission.submission_text}"
                        </p>
                      </div>
                    )}
                  </div>
                )}

                {/* Score Input Slider & Number */}
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <label className="text-xs font-bold text-slate-800 uppercase tracking-wider">
                      Numeric Score (0 - 100):
                    </label>
                    <span className="text-lg font-black font-mono text-blue-700">
                      {gradeScore}
                    </span>
                  </div>
                  <input
                    type="range"
                    min="0"
                    max="100"
                    step="1"
                    value={gradeScore}
                    onChange={(e) => setGradeScore(Number(e.target.value))}
                    className="w-full accent-blue-600 h-2 bg-slate-200 rounded-lg cursor-pointer"
                  />
                  <div className="flex justify-between text-[10px] text-slate-400 font-mono">
                    <span>0 (Unsatisfactory)</span>
                    <span>75 (Competency Benchmark)</span>
                    <span>100 (Mastery)</span>
                  </div>
                </div>

                {/* Status Toggle */}
                <div>
                  <label className="block text-xs font-bold text-slate-800 uppercase tracking-wider mb-1.5">
                    Evaluation Status:
                  </label>
                  <div className="grid grid-cols-2 gap-2">
                    <button
                      type="button"
                      onClick={() => setGradeStatus('passed')}
                      className={`p-2.5 rounded-xl border text-xs font-bold flex items-center justify-center gap-1.5 transition cursor-pointer ${
                        gradeStatus === 'passed'
                          ? 'bg-emerald-50 border-emerald-500 text-emerald-800 shadow-2xs'
                          : 'bg-white border-slate-200 text-slate-600 hover:bg-slate-50'
                      }`}
                    >
                      <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                      <span>Competency Passed</span>
                    </button>

                    <button
                      type="button"
                      onClick={() => setGradeStatus('revision')}
                      className={`p-2.5 rounded-xl border text-xs font-bold flex items-center justify-center gap-1.5 transition cursor-pointer ${
                        gradeStatus === 'revision'
                          ? 'bg-amber-50 border-amber-500 text-amber-800 shadow-2xs'
                          : 'bg-white border-slate-200 text-slate-600 hover:bg-slate-50'
                      }`}
                    >
                      <AlertTriangle className="w-4 h-4 text-amber-600" />
                      <span>Needs Revision</span>
                    </button>
                  </div>
                </div>

                {/* Qualitative Feedback */}
                <div>
                  <label className="block text-xs font-bold text-slate-800 uppercase tracking-wider mb-1">
                    Evaluator Feedback &amp; Suggestions:
                  </label>
                  <textarea
                    rows={3}
                    value={gradeFeedback}
                    onChange={(e) => setGradeFeedback(e.target.value)}
                    placeholder="Provide constructive feedback on circuit assembly, programming efficiency, and sensor calibrations..."
                    className="w-full p-3 rounded-2xl border border-slate-200 text-xs text-slate-800 focus:outline-none focus:ring-2 focus:ring-blue-500 bg-slate-50"
                  />
                </div>
              </div>

              {/* Footer */}
              <div className="p-5 bg-slate-50 border-t border-slate-200 flex items-center justify-end gap-2.5">
                <button
                  type="button"
                  onClick={() => setGradingTarget(null)}
                  className="px-4 py-2.5 rounded-xl border border-slate-200 text-slate-600 text-xs font-bold hover:bg-slate-100 transition cursor-pointer"
                >
                  Cancel
                </button>

                <button
                  type="button"
                  onClick={handleSaveGrade}
                  disabled={isSavingGrade}
                  className="px-5 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white text-xs font-bold transition flex items-center gap-1.5 cursor-pointer shadow-md active:scale-95"
                >
                  {isSavingGrade ? (
                    <>
                      <RefreshCw className="w-4 h-4 animate-spin" />
                      <span>Saving Grade...</span>
                    </>
                  ) : (
                    <>
                      <Check className="w-4 h-4" />
                      <span>Save &amp; Announce Grade</span>
                    </>
                  )}
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* ========================================================================= */}
      {/* 7. MODAL: Create New Practical Task */}
      {/* ========================================================================= */}
      <AnimatePresence>
        {isCreateModalOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs">
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="bg-white rounded-3xl border border-slate-200 w-full max-w-lg overflow-hidden shadow-2xl relative"
            >
              <div className="px-6 py-5 bg-gradient-to-r from-blue-700 to-indigo-700 text-white flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-2xl bg-white/20 text-white flex items-center justify-center font-bold">
                    <BookOpen className="w-5 h-5 text-white" />
                  </div>
                  <div>
                    <h3 className="text-base font-bold text-white">Create Practical Task</h3>
                    <p className="text-xs text-blue-100">Publish a new robotics workshop challenge or assignment</p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => setIsCreateModalOpen(false)}
                  className="p-1.5 rounded-xl bg-white/10 hover:bg-white/20 text-white transition cursor-pointer"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              <form onSubmit={handleCreateAssignment} className="p-6 space-y-4">
                <div>
                  <label className="block text-xs font-bold text-slate-800 uppercase tracking-wider mb-1">
                    Task Title *
                  </label>
                  <input
                    type="text"
                    required
                    value={newTitle}
                    onChange={(e) => setNewTitle(e.target.value)}
                    placeholder="e.g. Line Follower Robot PCB & Ultrasonic Prototyping"
                    className="w-full px-3 py-2 rounded-xl border border-slate-200 text-xs focus:outline-none focus:ring-2 focus:ring-blue-500 bg-slate-50"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-800 uppercase tracking-wider mb-1">
                    Curriculum Category
                  </label>
                  <select
                    value={newModuleCategory}
                    onChange={(e) => setNewModuleCategory(e.target.value)}
                    className="w-full px-3 py-2 rounded-xl border border-slate-200 text-xs bg-slate-50 text-slate-800 font-medium focus:outline-none focus:ring-2 focus:ring-blue-500"
                  >
                    <option value="IoT & Sensor Arduino">IoT &amp; Sensor Arduino</option>
                    <option value="Line Follower & Mobile Robot">Line Follower &amp; Mobile Robot</option>
                    <option value="ESP32 & Wireless Telemetry">ESP32 &amp; Wireless Telemetry</option>
                    <option value="3D Printing & CAD Mechanics">3D Printing &amp; CAD Mechanics</option>
                    <option value="Competition Team Trial">Competition Team Trial</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-800 uppercase tracking-wider mb-1">
                    Submission Due Date (Optional)
                  </label>
                  <input
                    type="date"
                    value={newDueDate}
                    onChange={(e) => setNewDueDate(e.target.value)}
                    className="w-full px-3 py-2 rounded-xl border border-slate-200 text-xs bg-slate-50 text-slate-800 focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-800 uppercase tracking-wider mb-1">
                    Guidelines &amp; Component List
                  </label>
                  <textarea
                    rows={3}
                    value={newDescription}
                    onChange={(e) => setNewDescription(e.target.value)}
                    placeholder="Specify the breadboard wiring, sensor pin assignments, test criteria, and submission format..."
                    className="w-full p-3 rounded-xl border border-slate-200 text-xs text-slate-800 bg-slate-50 focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>

                <div className="pt-2 flex items-center justify-end gap-2 border-t border-slate-100">
                  <button
                    type="button"
                    onClick={() => setIsCreateModalOpen(false)}
                    className="px-4 py-2 rounded-xl border border-slate-200 text-slate-600 text-xs font-bold hover:bg-slate-100 transition cursor-pointer"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={isCreating}
                    className="px-5 py-2 rounded-xl bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white text-xs font-bold transition flex items-center gap-1.5 cursor-pointer shadow-md active:scale-95"
                  >
                    {isCreating ? (
                      <>
                        <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                        <span>Creating...</span>
                      </>
                    ) : (
                      <>
                        <Plus className="w-3.5 h-3.5" />
                        <span>Publish Task</span>
                      </>
                    )}
                  </button>
                </div>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Task Deletion Confirmation Dialog */}
      <AnimatePresence>
        {taskToDelete && (
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
                <h4 className="text-sm font-bold text-slate-900">Delete Learning Task</h4>
                <p className="text-xs text-slate-500 mt-1">
                  Are you sure you want to delete task <strong>"{taskToDelete.title}"</strong>? All associated student submission records will also be removed.
                </p>
              </div>
              <div className="flex gap-2 pt-1">
                <button
                  type="button"
                  onClick={() => setTaskToDelete(null)}
                  className="flex-1 py-2 px-3 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-semibold transition cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={confirmDeleteTask}
                  className="flex-1 py-2 px-3 rounded-xl bg-rose-600 hover:bg-rose-700 text-white text-xs font-bold shadow-md shadow-rose-600/20 transition cursor-pointer"
                >
                  Delete Task
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
};
