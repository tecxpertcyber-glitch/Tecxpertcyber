"use client";

import React, { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Lightbulb,
  X,
  Send,
  Loader2,
  CheckCircle,
  AlertCircle,
  MessageSquarePlus,
} from "lucide-react";
import { cn } from "@/lib/utils";

const STORAGE_KEY = "tecxpert_suggestion_draft";
const MAX_LEN = 500;

/**
 * Floating suggestion widget for the public site.
 * Bottom-left so it doesn't clash with the WhatsApp button (bottom-right).
 */
export default function SuggestionBox() {
  const [open, setOpen] = useState(false);
  const [message, setMessage] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [feedback, setFeedback] = useState<{ ok: boolean; msg: string } | null>(null);
  const [justSent, setJustSent] = useState(false);

  // Restore draft from localStorage so refresh doesn't lose typing
  useEffect(() => {
    try {
      const draft = localStorage.getItem(STORAGE_KEY);
      if (draft) setMessage(draft);
    } catch {
      /* ignore */
    }
  }, []);

  useEffect(() => {
    try {
      if (message) localStorage.setItem(STORAGE_KEY, message);
      else localStorage.removeItem(STORAGE_KEY);
    } catch {
      /* ignore */
    }
  }, [message]);

  const submit = async () => {
    const trimmed = message.trim();
    if (trimmed.length < 3) {
      setFeedback({ ok: false, msg: "Please write a bit more (min 3 chars)" });
      return;
    }
    setSubmitting(true);
    setFeedback(null);
    try {
      const res = await fetch("/api/suggestions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message: trimmed }),
      });
      const data = await res.json();
      if (data.success) {
        setFeedback({ ok: true, msg: data.message || "Thanks!" });
        setMessage("");
        try {
          localStorage.removeItem(STORAGE_KEY);
        } catch {
          /* ignore */
        }
        setJustSent(true);
        // Auto-close after a moment
        setTimeout(() => {
          setOpen(false);
          setJustSent(false);
          setFeedback(null);
        }, 2000);
      } else {
        setFeedback({ ok: false, msg: data.error || "Failed to send" });
      }
    } catch {
      setFeedback({ ok: false, msg: "Network error. Please try again." });
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <>
      {/* Floating launch button — bottom-left so it doesn't clash w/ WhatsApp */}
      <button
        onClick={() => setOpen(true)}
        className="fixed bottom-6 left-6 z-40 flex items-center gap-2 px-4 py-3 bg-amber-500 hover:bg-amber-400 text-slate-900 rounded-full shadow-lg shadow-amber-500/30 transition-all hover:scale-105 font-semibold text-sm"
        aria-label="Send a suggestion"
      >
        <Lightbulb className="w-5 h-5" />
        <span className="hidden sm:inline">Suggest</span>
      </button>

      {/* Modal */}
      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={() => !submitting && setOpen(false)}
            className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-end sm:items-center justify-center p-0 sm:p-4"
          >
            <motion.div
              initial={{ y: 40, opacity: 0, scale: 0.95 }}
              animate={{ y: 0, opacity: 1, scale: 1 }}
              exit={{ y: 40, opacity: 0, scale: 0.95 }}
              onClick={(e) => e.stopPropagation()}
              className="bg-slate-900 border border-slate-800 w-full sm:max-w-md sm:rounded-2xl rounded-t-2xl shadow-2xl"
            >
              {/* Header */}
              <div className="flex items-center justify-between p-5 border-b border-slate-800">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-amber-500/20 flex items-center justify-center">
                    <MessageSquarePlus className="w-5 h-5 text-amber-400" />
                  </div>
                  <div>
                    <h2 className="font-bold text-lg text-white">Suggestion Box</h2>
                    <p className="text-xs text-slate-400">
                      Tell us what you&apos;d love to see
                    </p>
                  </div>
                </div>
                <button
                  onClick={() => setOpen(false)}
                  disabled={submitting}
                  className="p-2 text-slate-500 hover:text-white hover:bg-slate-800 rounded-lg disabled:opacity-50"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              {/* Body */}
              <div className="p-5 space-y-4">
                {justSent && feedback?.ok ? (
                  <div className="text-center py-8 space-y-3">
                    <div className="w-16 h-16 rounded-full bg-emerald-500 flex items-center justify-center mx-auto">
                      <CheckCircle className="w-9 h-9 text-white" strokeWidth={2.5} />
                    </div>
                    <p className="text-base text-white font-bold">
                      Thank you! 🎉
                    </p>
                    <p className="text-sm text-slate-400">
                      Your suggestion has been sent.
                    </p>
                  </div>
                ) : (
                  <>
                    <div>
                      <label className="block text-xs font-medium text-slate-300 mb-2">
                        What new service or improvement would you like?
                      </label>
                      <textarea
                        value={message}
                        onChange={(e) =>
                          setMessage(e.target.value.slice(0, MAX_LEN))
                        }
                        placeholder="e.g. Please add bursary application service, or open earlier on weekdays…"
                        rows={5}
                        className="w-full px-3 py-2.5 bg-slate-800 border border-slate-700 rounded-xl text-white placeholder-slate-500 focus:outline-none focus:border-amber-500 focus:ring-2 focus:ring-amber-500/20 resize-none text-sm"
                        autoFocus
                        disabled={submitting}
                      />
                      <div className="flex items-center justify-between mt-1.5 text-[11px] text-slate-500">
                        <span>Anonymous · auto-cleared after 24 hours</span>
                        <span className={cn(
                          message.length > MAX_LEN - 50 && "text-amber-400"
                        )}>
                          {message.length} / {MAX_LEN}
                        </span>
                      </div>
                    </div>

                    {feedback && (
                      <div
                        className={cn(
                          "flex items-center gap-2 p-3 rounded-lg text-sm",
                          feedback.ok
                            ? "bg-emerald-500/10 text-emerald-400 border border-emerald-500/30"
                            : "bg-red-500/10 text-red-400 border border-red-500/30"
                        )}
                      >
                        {feedback.ok ? (
                          <CheckCircle className="w-4 h-4 flex-shrink-0" />
                        ) : (
                          <AlertCircle className="w-4 h-4 flex-shrink-0" />
                        )}
                        <span>{feedback.msg}</span>
                      </div>
                    )}

                    <div className="flex gap-2">
                      <button
                        onClick={() => setOpen(false)}
                        disabled={submitting}
                        className="flex-1 py-2.5 bg-slate-800 hover:bg-slate-700 text-white rounded-xl font-semibold text-sm transition-colors disabled:opacity-50"
                      >
                        Cancel
                      </button>
                      <button
                        onClick={submit}
                        disabled={submitting || message.trim().length < 3}
                        className="flex-[2] py-2.5 bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-400 hover:to-amber-500 disabled:from-slate-700 disabled:to-slate-700 disabled:cursor-not-allowed text-slate-900 rounded-xl font-bold text-sm transition-all shadow-lg shadow-amber-500/20 flex items-center justify-center gap-2"
                      >
                        {submitting ? (
                          <Loader2 className="w-4 h-4 animate-spin" />
                        ) : (
                          <Send className="w-4 h-4" />
                        )}
                        {submitting ? "Sending…" : "Send Suggestion"}
                      </button>
                    </div>
                  </>
                )}
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}
