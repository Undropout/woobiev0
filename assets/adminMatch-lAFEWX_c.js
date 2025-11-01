import{_ as B,C as H,q as P,t as j,v as G,w as R,x as J,y as S,z as V,A as X,B as Y,F as K,f as Q,a as W,g as v,r as A,d as b}from"./firebase-config-CQBF9bbN.js";/**
 * @license
 * Copyright 2017 Google LLC
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *   http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */const z="type.googleapis.com/google.protobuf.Int64Value",Z="type.googleapis.com/google.protobuf.UInt64Value";function U(e,t){const r={};for(const n in e)e.hasOwnProperty(n)&&(r[n]=t(e[n]));return r}function k(e){if(e==null)return null;if(e instanceof Number&&(e=e.valueOf()),typeof e=="number"&&isFinite(e)||e===!0||e===!1||Object.prototype.toString.call(e)==="[object String]")return e;if(e instanceof Date)return e.toISOString();if(Array.isArray(e))return e.map(t=>k(t));if(typeof e=="function"||typeof e=="object")return U(e,t=>k(t));throw new Error("Data cannot be encoded in JSON: "+e)}function w(e){if(e==null)return e;if(e["@type"])switch(e["@type"]){case z:case Z:{const t=Number(e.value);if(isNaN(t))throw new Error("Data cannot be decoded from JSON: "+e);return t}default:throw new Error("Data cannot be decoded from JSON: "+e)}return Array.isArray(e)?e.map(t=>w(t)):typeof e=="function"||typeof e=="object"?U(e,t=>w(t)):e}/**
 * @license
 * Copyright 2020 Google LLC
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *   http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */const D="functions";/**
 * @license
 * Copyright 2017 Google LLC
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *   http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */const L={OK:"ok",CANCELLED:"cancelled",UNKNOWN:"unknown",INVALID_ARGUMENT:"invalid-argument",DEADLINE_EXCEEDED:"deadline-exceeded",NOT_FOUND:"not-found",ALREADY_EXISTS:"already-exists",PERMISSION_DENIED:"permission-denied",UNAUTHENTICATED:"unauthenticated",RESOURCE_EXHAUSTED:"resource-exhausted",FAILED_PRECONDITION:"failed-precondition",ABORTED:"aborted",OUT_OF_RANGE:"out-of-range",UNIMPLEMENTED:"unimplemented",INTERNAL:"internal",UNAVAILABLE:"unavailable",DATA_LOSS:"data-loss"};class f extends K{constructor(t,r,n){super(`${D}/${t}`,r||""),this.details=n,Object.setPrototypeOf(this,f.prototype)}}function ee(e){if(e>=200&&e<300)return"ok";switch(e){case 0:return"internal";case 400:return"invalid-argument";case 401:return"unauthenticated";case 403:return"permission-denied";case 404:return"not-found";case 409:return"aborted";case 429:return"resource-exhausted";case 499:return"cancelled";case 500:return"internal";case 501:return"unimplemented";case 503:return"unavailable";case 504:return"deadline-exceeded"}return"unknown"}function T(e,t){let r=ee(e),n=r,s;try{const o=t&&t.error;if(o){const a=o.status;if(typeof a=="string"){if(!L[a])return new f("internal","internal");r=L[a],n=a}const i=o.message;typeof i=="string"&&(n=i),s=o.details,s!==void 0&&(s=w(s))}}catch{}return r==="ok"?null:new f(r,n,s)}/**
 * @license
 * Copyright 2017 Google LLC
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *   http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */class te{constructor(t,r,n,s){this.app=t,this.auth=null,this.messaging=null,this.appCheck=null,this.serverAppAppCheckToken=null,j(t)&&t.settings.appCheckToken&&(this.serverAppAppCheckToken=t.settings.appCheckToken),this.auth=r.getImmediate({optional:!0}),this.messaging=n.getImmediate({optional:!0}),this.auth||r.get().then(o=>this.auth=o,()=>{}),this.messaging||n.get().then(o=>this.messaging=o,()=>{}),this.appCheck||s==null||s.get().then(o=>this.appCheck=o,()=>{})}async getAuthToken(){if(this.auth)try{const t=await this.auth.getToken();return t==null?void 0:t.accessToken}catch{return}}async getMessagingToken(){if(!(!this.messaging||!("Notification"in self)||Notification.permission!=="granted"))try{return await this.messaging.getToken()}catch{return}}async getAppCheckToken(t){if(this.serverAppAppCheckToken)return this.serverAppAppCheckToken;if(this.appCheck){const r=t?await this.appCheck.getLimitedUseToken():await this.appCheck.getToken();return r.error?null:r.token}return null}async getContext(t){const r=await this.getAuthToken(),n=await this.getMessagingToken(),s=await this.getAppCheckToken(t);return{authToken:r,messagingToken:n,appCheckToken:s}}}/**
 * @license
 * Copyright 2017 Google LLC
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *   http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */const C="us-central1",ne=/^data: (.*?)(?:\n|$)/;function re(e){let t=null;return{promise:new Promise((r,n)=>{t=setTimeout(()=>{n(new f("deadline-exceeded","deadline-exceeded"))},e)}),cancel:()=>{t&&clearTimeout(t)}}}class se{constructor(t,r,n,s,o=C,a=(...i)=>fetch(...i)){this.app=t,this.fetchImpl=a,this.emulatorOrigin=null,this.contextProvider=new te(t,r,n,s),this.cancelAllRequests=new Promise(i=>{this.deleteService=()=>Promise.resolve(i())});try{const i=new URL(o);this.customDomain=i.origin+(i.pathname==="/"?"":i.pathname),this.region=C}catch{this.customDomain=null,this.region=o}}_delete(){return this.deleteService()}_url(t){const r=this.app.options.projectId;return this.emulatorOrigin!==null?`${this.emulatorOrigin}/${r}/${this.region}/${t}`:this.customDomain!==null?`${this.customDomain}/${t}`:`https://${this.region}-${r}.cloudfunctions.net/${t}`}}function oe(e,t,r){const n=X(t);e.emulatorOrigin=`http${n?"s":""}://${t}:${r}`,n&&(Y(e.emulatorOrigin),R("Functions",!0))}function ie(e,t,r){const n=s=>ce(e,t,s,{});return n.stream=(s,o)=>le(e,t,s,o),n}async function ae(e,t,r,n){r["Content-Type"]="application/json";let s;try{s=await n(e,{method:"POST",body:JSON.stringify(t),headers:r})}catch{return{status:0,json:null}}let o=null;try{o=await s.json()}catch{}return{status:s.status,json:o}}async function F(e,t){const r={},n=await e.contextProvider.getContext(t.limitedUseAppCheckTokens);return n.authToken&&(r.Authorization="Bearer "+n.authToken),n.messagingToken&&(r["Firebase-Instance-ID-Token"]=n.messagingToken),n.appCheckToken!==null&&(r["X-Firebase-AppCheck"]=n.appCheckToken),r}function ce(e,t,r,n){const s=e._url(t);return ue(e,s,r,n)}async function ue(e,t,r,n){r=k(r);const s={data:r},o=await F(e,n),a=n.timeout||7e4,i=re(a),l=await Promise.race([ae(t,s,o,e.fetchImpl),i.promise,e.cancelAllRequests]);if(i.cancel(),!l)throw new f("cancelled","Firebase Functions instance was deleted.");const d=T(l.status,l.json);if(d)throw d;if(!l.json)throw new f("internal","Response is not valid JSON object.");let c=l.json.data;if(typeof c>"u"&&(c=l.json.result),typeof c>"u")throw new f("internal","Response is missing data field.");return{data:w(c)}}function le(e,t,r,n){const s=e._url(t);return de(e,s,r,n||{})}async function de(e,t,r,n){var s;r=k(r);const o={data:r},a=await F(e,n);a["Content-Type"]="application/json",a.Accept="text/event-stream";let i;try{i=await e.fetchImpl(t,{method:"POST",body:JSON.stringify(o),headers:a,signal:n==null?void 0:n.signal})}catch(h){if(h instanceof Error&&h.name==="AbortError"){const E=new f("cancelled","Request was cancelled.");return{data:Promise.reject(E),stream:{[Symbol.asyncIterator](){return{next(){return Promise.reject(E)}}}}}}const y=T(0,null);return{data:Promise.reject(y),stream:{[Symbol.asyncIterator](){return{next(){return Promise.reject(y)}}}}}}let l,d;const c=new Promise((h,y)=>{l=h,d=y});(s=n==null?void 0:n.signal)===null||s===void 0||s.addEventListener("abort",()=>{const h=new f("cancelled","Request was cancelled.");d(h)});const p=i.body.getReader(),g=fe(p,l,d,n==null?void 0:n.signal);return{stream:{[Symbol.asyncIterator](){const h=g.getReader();return{async next(){const{value:y,done:E}=await h.read();return{value:y,done:E}},async return(){return await h.cancel(),{done:!0,value:void 0}}}}},data:c}}function fe(e,t,r,n){const s=(a,i)=>{const l=a.match(ne);if(!l)return;const d=l[1];try{const c=JSON.parse(d);if("result"in c){t(w(c.result));return}if("message"in c){i.enqueue(w(c.message));return}if("error"in c){const p=T(0,c);i.error(p),r(p);return}}catch(c){if(c instanceof f){i.error(c),r(c);return}}},o=new TextDecoder;return new ReadableStream({start(a){let i="";return l();async function l(){if(n!=null&&n.aborted){const d=new f("cancelled","Request was cancelled");return a.error(d),r(d),Promise.resolve()}try{const{value:d,done:c}=await e.read();if(c){i.trim()&&s(i.trim(),a),a.close();return}if(n!=null&&n.aborted){const g=new f("cancelled","Request was cancelled");a.error(g),r(g),await e.cancel();return}i+=o.decode(d,{stream:!0});const p=i.split(`
`);i=p.pop()||"";for(const g of p)g.trim()&&s(g.trim(),a);return l()}catch(d){const c=d instanceof f?d:T(0,null);a.error(c),r(c)}}},cancel(){return e.cancel()}})}const $="@firebase/functions",x="0.12.6";/**
 * @license
 * Copyright 2019 Google LLC
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *   http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */const me="auth-internal",he="app-check-internal",pe="messaging-internal";function ge(e){const t=(r,{instanceIdentifier:n})=>{const s=r.getProvider("app").getImmediate(),o=r.getProvider(me),a=r.getProvider(pe),i=r.getProvider(he);return new se(s,o,a,i,n)};B(new H(D,t,"PUBLIC").setMultipleInstances(!0)),P($,x,e),P($,x,"esm2017")}/**
 * @license
 * Copyright 2020 Google LLC
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *   http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */function ye(e=G(),t=C){R("Functions",!1);const n=J(S(e),D).getImmediate({identifier:t}),s=V("functions");return s&&we(n,...s),n}function we(e,t,r){oe(S(e),t,r)}function M(e,t,r){return ie(S(e),t)}ge();const q=ye();M(q,"listQueue");const Ee=M(q,"forceMatchUsers"),_=document.getElementById("login-btn"),O=document.getElementById("list-btn"),I=document.getElementById("match-btn"),u=document.getElementById("status"),N=document.getElementById("queue");let m=[];_.onclick=async()=>{const e=prompt("Enter your email:"),t=prompt("Enter your password:");try{await Q(W,e,t),u.textContent="✅ Logged in",u.className="success",O.disabled=!1,_.disabled=!0}catch(r){u.textContent=`❌ Login failed: ${r.message}`,u.className="error"}};O.onclick=async()=>{try{u.textContent="Loading queue...",u.className="info";const t=(await v(A(b,"queue"))).val();if(N.innerHTML="<h2>Current Queue:</h2>",!t){N.innerHTML+="<p>Queue is empty!</p>";return}const r=[];for(const[n,s]of Object.entries(t))r.push({uid:n,data:s});r.forEach(({uid:n,data:s})=>{var a,i;const o=document.createElement("div");o.className="user",o.innerHTML=`
            <strong>${s.woobieName}</strong><br>
            UID: ${n}<br>
            Gender: ${s.gender} | Looking for: ${(a=s.lookingForGender)==null?void 0:a.join(", ")}<br>
            Interests: ${(i=s.interests)==null?void 0:i.slice(0,3).join(", ")}...<br>
            MatchID: ${s.potentialMatchIDForUser}
          `,o.onclick=()=>{m.includes(n)?(m=m.filter(l=>l!==n),o.classList.remove("selected")):m.length<2&&(m.push(n),o.classList.add("selected")),I.disabled=m.length!==2,u.textContent=`Selected: ${m.length}/2`,u.className="info"},N.appendChild(o)}),u.textContent=`✅ ${r.length} users in queue`,u.className="success"}catch(e){u.textContent=`❌ Error: ${e.message}`,u.className="error"}};I.onclick=async()=>{if(m.length!==2){alert("Please select exactly 2 users");return}const[e,t]=m;if(confirm(`Match these two users?

UID1: ${e}
UID2: ${t}`))try{u.textContent="Creating match...",u.className="info";const r=await v(A(b,`queue/${e}`)),n=await v(A(b,`queue/${t}`));if(!r.exists()||!n.exists())throw new Error("One or both users not found in queue");const s=r.val(),o=n.val(),a=await Ee({uid1:e,uid2:t});u.textContent=`✅ Match created! ${a.data.user1} + ${a.data.user2}`,u.className="success",m=[],I.disabled=!0,setTimeout(()=>O.click(),2e3)}catch(r){u.textContent=`❌ Error: ${r.message}`,u.className="error",console.error(r)}};
