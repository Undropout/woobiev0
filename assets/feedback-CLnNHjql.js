import{a as m,r as u,d as p,p as y,b as g}from"./firebase-config-CQBF9bbN.js";function s(){const n=document.createElement("button");n.id="feedback-btn",n.className="woobie-button",n.innerHTML="💬 Feedback",n.style.cssText=`
    position: fixed;
    bottom: 1rem;
    right: 1rem;
    z-index: 9998;
    padding: 0.5rem 1rem;
    font-size: 0.9rem;
    opacity: 0.8;
  `;const e=document.createElement("div");e.id="feedback-modal",e.style.cssText=`
    display: none;
    position: fixed;
    top: 0;
    left: 0;
    width: 100vw;
    height: 100vh;
    background: rgba(0, 0, 0, 0.95);
    z-index: 9999;
    padding: 2rem;
    overflow: auto;
  `,e.innerHTML=`
    <div style="max-width: 600px; margin: 0 auto; background: #000; border: 2px solid #33ff33; border-radius: 10px; padding: 2rem;">
      <h2 style="color: #33ff33; margin-top: 0;">💬 Send Us Feedback</h2>
      <p style="color: #fff;">We'd love to hear from you! Share bugs, suggestions, or just say hi.</p>

      <label for="feedback-type" style="color: #33ff33; display: block; margin-top: 1rem;">Type:</label>
      <select id="feedback-type" style="width: 100%; padding: 0.5rem; background: #111; color: #33ff33; border: 1px solid #33ff33; border-radius: 5px; margin-bottom: 1rem;">
        <option value="bug">🐛 Bug Report</option>
        <option value="suggestion">💡 Suggestion</option>
        <option value="feedback">💬 General Feedback</option>
        <option value="other">📝 Other</option>
      </select>

      <label for="feedback-text" style="color: #33ff33; display: block;">Message:</label>
      <textarea id="feedback-text" rows="6" placeholder="Tell us what's on your mind..." style="width: 100%; padding: 0.5rem; background: #111; color: #fff; border: 1px solid #33ff33; border-radius: 5px; font-family: 'Atkinson Hyperlegible', monospace; resize: vertical;"></textarea>

      <p style="color: #888; font-size: 0.85rem; margin-top: 0.5rem;">Or email us directly at <a href="mailto:friends@woobie.fun" style="color: #33ff33;">friends@woobie.fun</a></p>

      <div id="feedback-status" style="color: #33ff33; margin-top: 1rem; min-height: 1.5rem;"></div>

      <div style="display: flex; gap: 1rem; margin-top: 1rem;">
        <button id="feedback-submit" class="woobie-button" style="flex: 1;">Send Feedback →</button>
        <button id="feedback-cancel" class="woobie-button" style="flex: 1; background: #222; border-color: #ff6666; color: #ff6666;">Cancel</button>
      </div>
    </div>
  `,document.body.appendChild(n),document.body.appendChild(e);const i=document.getElementById("feedback-text"),l=document.getElementById("feedback-type"),t=document.getElementById("feedback-status"),a=document.getElementById("feedback-submit"),r=document.getElementById("feedback-cancel");n.onclick=()=>{e.style.display="block",i.value="",t.textContent=""},r.onclick=()=>{e.style.display="none"},a.onclick=async()=>{const d=i.value.trim(),c=l.value;if(!d){t.style.color="#ff6666",t.textContent="Please enter a message.";return}a.disabled=!0,t.style.color="#33ff33",t.textContent="Sending...";try{const o=m.currentUser,f=u(p,"feedback"),b=y(f);await g(b,{type:c,message:d,timestamp:Date.now(),userEmail:(o==null?void 0:o.email)||"anonymous",userUID:(o==null?void 0:o.uid)||"anonymous",username:localStorage.getItem("woobieUsername")||"unknown",page:window.location.pathname}),t.textContent="✅ Thank you! Your feedback has been sent.",i.value="",setTimeout(()=>{e.style.display="none",a.disabled=!1},2e3)}catch(o){console.error("Error submitting feedback:",o),t.style.color="#ff6666",t.textContent="Error sending feedback. Please email us at friends@woobie.fun",a.disabled=!1}},e.onclick=d=>{d.target===e&&(e.style.display="none")}}document.readyState==="loading"?document.addEventListener("DOMContentLoaded",s):s();
