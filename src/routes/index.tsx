import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { login, loginDemo } from "@/lib/auth";
import { Loader2, ArrowRight, Leaf, ChevronRight } from "lucide-react";

export const Route = createFileRoute("/")({ component: Login });

const STATS = [
  { value: "100+", label: "GHG inventories" },
  { value: "15", label: "Scope 3 categories" },
  { value: "GHG Protocol", label: "aligned" },
];

function Login() {
  const navigate = useNavigate();
  const [email, setEmail]     = useState("");
  const [password, setPassword] = useState("");
  const [error, setError]     = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      await login(email, password);
      navigate({ to: "/workstreams" });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Login failed");
      setLoading(false);
    }
  };

  return (
    <div style={{ display:"flex", minHeight:"100vh", fontFamily:"'Inter',sans-serif" }}>

      {/* ── LEFT PANEL ─────────────────────────────────────────────────────── */}
      <div style={{
        display:"none", flex:"0 0 52%", flexDirection:"column", justifyContent:"space-between",
        background:"#06160E", padding:"48px 56px", position:"relative", overflow:"hidden",
        // show on lg+
      }} className="hidden lg:flex lg:flex-col">

        {/* Subtle grid texture */}
        <div style={{
          position:"absolute", inset:0, opacity:0.04,
          backgroundImage:"linear-gradient(#fff 1px,transparent 1px),linear-gradient(90deg,#fff 1px,transparent 1px)",
          backgroundSize:"48px 48px",
        }}/>

        {/* Green glow blob */}
        <div style={{
          position:"absolute", width:520, height:520,
          top:-100, right:-140,
          background:"radial-gradient(circle,#1E6F5C 0%,transparent 68%)",
          opacity:0.25, borderRadius:"50%",
        }}/>
        <div style={{
          position:"absolute", width:320, height:320,
          bottom:80, left:-80,
          background:"radial-gradient(circle,#2A9D74 0%,transparent 70%)",
          opacity:0.18, borderRadius:"50%",
        }}/>

        {/* Logo */}
        <div style={{ position:"relative", zIndex:2 }}>
          <img src="/deepwoods-logo.png" alt="Deepwoods Green" style={{ height:36, width:"auto" }}
            onError={e=>{ (e.currentTarget as HTMLImageElement).style.display="none"; }} />
        </div>

        {/* Hero copy */}
        <div style={{ position:"relative", zIndex:2 }}>
          <div style={{
            display:"inline-flex", alignItems:"center", gap:8,
            background:"rgba(30,111,92,0.25)", border:"1px solid rgba(30,111,92,0.5)",
            borderRadius:999, padding:"6px 16px", marginBottom:28,
          }}>
            <Leaf style={{ width:13, height:13, color:"#4ade80" }}/>
            <span style={{ fontSize:11, fontWeight:700, letterSpacing:"0.12em", textTransform:"uppercase", color:"#4ade80" }}>
              GHG Reporting Platform
            </span>
          </div>

          <h1 style={{ fontSize:48, fontWeight:800, lineHeight:1.1, color:"#ffffff", margin:0, letterSpacing:"-0.03em" }}>
            Measure, manage<br/>
            <span style={{ color:"#4ade80" }}>and reduce</span><br/>
            your emissions.
          </h1>

          <p style={{ marginTop:20, fontSize:16, color:"rgba(255,255,255,0.5)", lineHeight:1.7, maxWidth:420 }}>
            End-to-end GHG inventory, decarbonisation planning, and automated
            reporting — built for organisations serious about net zero.
          </p>

          {/* Stats row */}
          <div style={{ display:"flex", gap:32, marginTop:40 }}>
            {STATS.map(s => (
              <div key={s.label}>
                <div style={{ fontSize:22, fontWeight:800, color:"#ffffff", letterSpacing:"-0.02em" }}>{s.value}</div>
                <div style={{ fontSize:12, color:"rgba(255,255,255,0.4)", marginTop:2 }}>{s.label}</div>
              </div>
            ))}
          </div>
        </div>

        {/* Footer */}
        <div style={{ position:"relative", zIndex:2, fontSize:11, color:"rgba(255,255,255,0.2)" }}>
          © 2026 Deepwoods Green Consulting · Data encrypted in transit and at rest
        </div>
      </div>

      {/* ── RIGHT PANEL ────────────────────────────────────────────────────── */}
      <div style={{
        flex:1, display:"flex", flexDirection:"column", alignItems:"center",
        justifyContent:"center", background:"#ffffff", padding:"40px 24px",
        overflowY:"auto",
      }}>
        {/* Mobile logo */}
        <div className="lg:hidden" style={{ marginBottom:32 }}>
          <img src="/deepwoods-logo.png" alt="Deepwoods Green" style={{ height:32, width:"auto" }}
            onError={e=>{ (e.currentTarget as HTMLImageElement).style.display="none"; }}/>
        </div>

        <div style={{ width:"100%", maxWidth:400 }}>

          {/* Heading */}
          <div style={{ marginBottom:32 }}>
            <h2 style={{ fontSize:26, fontWeight:800, color:"#0B1F14", margin:0, letterSpacing:"-0.02em" }}>
              Welcome back
            </h2>
            <p style={{ marginTop:6, fontSize:14, color:"#6B7280" }}>Sign in to your GHG portal</p>
          </div>

          {error && (
            <div style={{
              marginBottom:20, padding:"12px 16px", borderRadius:10,
              background:"#FEF2F2", border:"1px solid #FECACA", color:"#DC2626", fontSize:13,
            }}>{error}</div>
          )}

          {/* Sign-in form */}
          <form onSubmit={submit}>
            <div style={{ marginBottom:16 }}>
              <label style={{ display:"block", marginBottom:6, fontSize:12, fontWeight:600, color:"#374151", textTransform:"uppercase", letterSpacing:"0.07em" }}>
                Email address
              </label>
              <input
                type="email" required value={email} onChange={e=>setEmail(e.target.value)}
                placeholder="you@company.com"
                style={{
                  width:"100%", padding:"11px 14px", border:"1.5px solid #E5E7EB",
                  borderRadius:10, fontSize:14, color:"#111827", background:"#F9FAFB",
                  outline:"none", boxSizing:"border-box", transition:"border-color .15s",
                }}
                onFocus={e=>e.currentTarget.style.borderColor="#1E6F5C"}
                onBlur={e=>e.currentTarget.style.borderColor="#E5E7EB"}
              />
            </div>

            <div style={{ marginBottom:20 }}>
              <div style={{ display:"flex", justifyContent:"space-between", marginBottom:6 }}>
                <label style={{ fontSize:12, fontWeight:600, color:"#374151", textTransform:"uppercase", letterSpacing:"0.07em" }}>
                  Password
                </label>
                <Link to="/forgot-password" style={{ fontSize:12, color:"#1E6F5C", textDecoration:"none", fontWeight:500 }}>
                  Forgot password?
                </Link>
              </div>
              <input
                type="password" required value={password} onChange={e=>setPassword(e.target.value)}
                placeholder="••••••••"
                style={{
                  width:"100%", padding:"11px 14px", border:"1.5px solid #E5E7EB",
                  borderRadius:10, fontSize:14, color:"#111827", background:"#F9FAFB",
                  outline:"none", boxSizing:"border-box", transition:"border-color .15s",
                }}
                onFocus={e=>e.currentTarget.style.borderColor="#1E6F5C"}
                onBlur={e=>e.currentTarget.style.borderColor="#E5E7EB"}
              />
            </div>

            <button type="submit" disabled={loading} style={{
              width:"100%", padding:"12px", borderRadius:10, border:"none",
              background: loading ? "#9CA3AF" : "#1E6F5C",
              color:"#fff", fontSize:14, fontWeight:700, cursor: loading ? "not-allowed" : "pointer",
              display:"flex", alignItems:"center", justifyContent:"center", gap:8,
              transition:"background .15s",
            }}
              onMouseEnter={e=>{ if(!loading)(e.currentTarget as HTMLButtonElement).style.background="#155E4A"; }}
              onMouseLeave={e=>{ if(!loading)(e.currentTarget as HTMLButtonElement).style.background="#1E6F5C"; }}
            >
              {loading && <Loader2 style={{ width:16, height:16, animation:"spin 1s linear infinite" }}/>}
              {loading ? "Signing in…" : "Sign in"}
            </button>
          </form>

          {/* Divider */}
          <div style={{ display:"flex", alignItems:"center", gap:12, margin:"24px 0", color:"#9CA3AF", fontSize:11, fontWeight:600, textTransform:"uppercase", letterSpacing:"0.1em" }}>
            <div style={{ flex:1, height:1, background:"#F3F4F6" }}/>
            Or explore
            <div style={{ flex:1, height:1, background:"#F3F4F6" }}/>
          </div>

          {/* Demo portal */}
          <button
            onClick={()=>{ loginDemo(); navigate({ to:"/workstreams" }); }}
            style={{
              width:"100%", display:"flex", alignItems:"center", justifyContent:"space-between",
              padding:"13px 16px", borderRadius:12, border:"1.5px solid #E5E7EB",
              background:"#FAFAFA", cursor:"pointer", transition:"all .15s",
            }}
            onMouseEnter={e=>{
              const b = e.currentTarget as HTMLButtonElement;
              b.style.borderColor="#1E6F5C"; b.style.background="#F0FDF8";
            }}
            onMouseLeave={e=>{
              const b = e.currentTarget as HTMLButtonElement;
              b.style.borderColor="#E5E7EB"; b.style.background="#FAFAFA";
            }}
          >
            <div style={{ display:"flex", alignItems:"center", gap:12 }}>
              <div style={{
                width:36, height:36, borderRadius:8, background:"#E6F4EF",
                border:"1px solid #BBE0D3", display:"flex", alignItems:"center", justifyContent:"center",
                flexShrink:0,
              }}>
                <Leaf style={{ width:18, height:18, color:"#1E6F5C" }}/>
              </div>
              <div style={{ textAlign:"left" }}>
                <div style={{ fontSize:13, fontWeight:700, color:"#111827" }}>Demo portal</div>
                <div style={{ fontSize:11, color:"#6B7280", marginTop:1 }}>Explore a sample GHG portal — no login needed</div>
              </div>
            </div>
            <ChevronRight style={{ width:16, height:16, color:"#9CA3AF", flexShrink:0 }}/>
          </button>

          {/* Divider */}
          <div style={{ display:"flex", alignItems:"center", gap:12, margin:"16px 0", color:"#9CA3AF", fontSize:11, fontWeight:600, textTransform:"uppercase", letterSpacing:"0.1em" }}>
            <div style={{ flex:1, height:1, background:"#F3F4F6" }}/>
            New client?
            <div style={{ flex:1, height:1, background:"#F3F4F6" }}/>
          </div>

          {/* Start inventory */}
          <Link to="/onboard" style={{ textDecoration:"none" }}>
            <div style={{
              display:"flex", alignItems:"center", justifyContent:"space-between",
              padding:"13px 16px", borderRadius:12,
              border:"1.5px solid #1E6F5C", background:"#F0FDF8", cursor:"pointer",
              transition:"all .15s",
            }}>
              <div style={{ display:"flex", alignItems:"center", gap:12 }}>
                <div style={{
                  width:36, height:36, borderRadius:8, background:"#1E6F5C",
                  display:"flex", alignItems:"center", justifyContent:"center", flexShrink:0,
                }}>
                  <Leaf style={{ width:18, height:18, color:"#fff" }}/>
                </div>
                <div>
                  <div style={{ fontSize:13, fontWeight:700, color:"#1E6F5C" }}>Start your GHG inventory</div>
                  <div style={{ fontSize:11, color:"#4B7C6A", marginTop:1 }}>Set up boundary &amp; begin data collection</div>
                </div>
              </div>
              <ArrowRight style={{ width:16, height:16, color:"#1E6F5C", flexShrink:0 }}/>
            </div>
          </Link>

          <p style={{ marginTop:24, textAlign:"center", fontSize:11, color:"#9CA3AF" }}>
            Access is by invitation — contact your Deepwoods account manager.
          </p>
        </div>
      </div>

      <style>{`@keyframes spin{from{transform:rotate(0deg)}to{transform:rotate(360deg)}}`}</style>
    </div>
  );
}
