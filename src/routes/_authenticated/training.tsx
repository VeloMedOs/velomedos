import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { GraduationCap, Award, CheckCircle2 } from "lucide-react";

export const Route = createFileRoute("/_authenticated/training")({ component: Training });

type Course = { id: string; title: string; summary: string | null; level: string | null; duration_hours: number | null; price: number | null };
type Module = { id: string; course_id: string; idx: number; title: string; content: string | null };
type Enrollment = { id: string; course_id: string; progress: number; completed_at: string | null };
type Cert = { id: string; enrollment_id: string; code: string; issued_at: string };

function Training() {
  const [courses, setCourses] = useState<Course[]>([]);
  const [enrollments, setEnrollments] = useState<Enrollment[]>([]);
  const [certs, setCerts] = useState<Cert[]>([]);
  const [active, setActive] = useState<Course | null>(null);
  const [modules, setModules] = useState<Module[]>([]);

  async function refresh() {
    const { data: { user } } = await supabase.auth.getUser();
    const [c, e, ce] = await Promise.all([
      supabase.from("courses").select("id,title,summary,level,duration_hours,price").order("title"),
      user ? supabase.from("enrollments").select("id,course_id,progress,completed_at").eq("user_id", user.id) : Promise.resolve({ data: [] }),
      user ? supabase.from("certificates").select("id,enrollment_id,code,issued_at") : Promise.resolve({ data: [] }),
    ]);
    if (c.data) setCourses(c.data as Course[]);
    if (e.data) setEnrollments(e.data as Enrollment[]);
    if (ce.data) setCerts(ce.data as Cert[]);
  }
  useEffect(() => { refresh(); }, []);

  async function openCourse(c: Course) {
    setActive(c);
    const { data } = await supabase.from("course_modules").select("id,course_id,idx,title,content").eq("course_id", c.id).order("idx");
    setModules((data ?? []) as Module[]);
  }

  async function enroll(c: Course) {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return toast.error("Sign in first");
    const { error } = await supabase.from("enrollments").insert({ course_id: c.id, user_id: user.id });
    if (error) return toast.error(error.message);
    toast.success(`Enrolled in ${c.title}`); refresh();
  }

  async function complete(enr: Enrollment) {
    await supabase.from("enrollments").update({ progress: 100, completed_at: new Date().toISOString() }).eq("id", enr.id);
    await supabase.from("certificates").insert({ enrollment_id: enr.id });
    toast.success("Certificate issued"); refresh();
  }

  return (
    <div className="max-w-5xl mx-auto p-4 lg:p-6 space-y-6">
      <div>
        <div className="mono text-[10px] uppercase tracking-[0.22em] text-muted-foreground">Training & Certification</div>
        <h1 className="text-2xl font-bold tracking-tight">Become certified on the platform</h1>
      </div>
      <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-3">
        {courses.map((c) => {
          const enr = enrollments.find((e) => e.course_id === c.id);
          const cert = enr ? certs.find((x) => x.enrollment_id === enr.id) : undefined;
          return (
            <div key={c.id} className="rounded-lg border border-hairline bg-panel p-4 space-y-2">
              <div className="flex items-center justify-between">
                <span className="mono text-[10px] uppercase tracking-widest text-action">{c.level}</span>
                <span className="mono text-[10px] uppercase tracking-widest text-muted-foreground">{c.duration_hours}h</span>
              </div>
              <div className="font-semibold">{c.title}</div>
              <p className="text-xs text-muted-foreground">{c.summary}</p>
              <div className="flex items-center justify-between border-t border-hairline pt-2">
                <div className="mono font-bold">${c.price ?? 0}</div>
                {cert ? (
                  <span className="mono text-[10px] uppercase tracking-widest text-stable inline-flex items-center gap-1"><Award className="size-3" /> Certified</span>
                ) : enr ? (
                  <div className="flex gap-2">
                    <button onClick={() => openCourse(c)} className="mono text-[10px] uppercase tracking-widest px-2 py-1 rounded border border-hairline">Open</button>
                    <button onClick={() => complete(enr)} className="mono text-[10px] uppercase tracking-widest px-2 py-1 rounded bg-stable text-background font-bold">Finish</button>
                  </div>
                ) : (
                  <button onClick={() => enroll(c)} className="mono text-[10px] uppercase tracking-widest px-3 py-1.5 rounded bg-action text-action-foreground font-bold">Enroll</button>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {certs.length > 0 && (
        <div className="space-y-2">
          <div className="mono text-[10px] uppercase tracking-[0.22em] text-muted-foreground">My certificates</div>
          <div className="grid md:grid-cols-2 gap-3">
            {certs.map((c) => {
              const enr = enrollments.find((e) => e.id === c.enrollment_id);
              const course = courses.find((co) => co.id === enr?.course_id);
              return (
                <div key={c.id} className="rounded-lg border border-stable/40 bg-stable/5 p-4">
                  <div className="flex items-center gap-2 mono text-[10px] uppercase tracking-widest text-stable"><Award className="size-3.5" /> Certified</div>
                  <div className="text-lg font-bold mt-1">{course?.title ?? "Course"}</div>
                  <div className="mono text-[11px] text-muted-foreground">Code: {c.code}</div>
                  <div className="mono text-[10px] text-muted-foreground">Issued {new Date(c.issued_at).toLocaleDateString()}</div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {active && (
        <div className="fixed inset-0 z-50 bg-black/60 grid place-items-center p-4" onClick={() => setActive(null)}>
          <div className="w-full max-w-2xl max-h-[80vh] overflow-y-auto bg-panel border border-hairline rounded-xl p-6 space-y-3" onClick={(e) => e.stopPropagation()}>
            <div className="mono text-[10px] uppercase tracking-[0.22em] text-action">Course content</div>
            <h3 className="text-xl font-bold">{active.title}</h3>
            <ol className="space-y-3 mt-4">
              {modules.map((m) => (
                <li key={m.id} className="border-l-2 border-action pl-4">
                  <div className="mono text-[10px] uppercase tracking-widest text-muted-foreground">Module {m.idx}</div>
                  <div className="font-semibold">{m.title}</div>
                  {m.content && <p className="text-sm text-muted-foreground mt-1">{m.content}</p>}
                </li>
              ))}
              {modules.length === 0 && <div className="text-sm text-muted-foreground">No modules published yet</div>}
            </ol>
          </div>
        </div>
      )}
    </div>
  );
}