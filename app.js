(() => {
  'use strict';
  let VENUES = [
    ['all','All'],['conf_iedm','IEDM'],['conf_vlsi_symposium','VLSI Symposium'],['conf_isscc','ISSCC'],
    ['journal_nature_electronics','Nature Electronics'],['journal_advanced_functional_materials','Advanced Functional Materials'],['journal_acs_nano','ACS Nano'],
    ['journal_nature_communications','Nature Communications'],['journal_nano_energy','Nano Energy'],['journal_advanced_science','Advanced Science'],['journal_small','Small'],
    ['journal_science_advances','Science Advances'],['journal_nano_letters','Nano Letters'],['journal_materials_horizons','Materials Horizons'],
    ['journal_acs_materials_letters','ACS Materials Letters'],['journal_acs_applied_materials_interfaces','ACS Applied Materials & Interfaces'],
    ['journal_advanced_intelligent_systems','Advanced Intelligent Systems'],['journal_nanoscale','Nanoscale'],
    ['journal_ieee_electron_device_letters','IEEE Electron Device Letters'],['journal_applied_physics_letters','Applied Physics Letters'],
    ['journal_ieee_transactions_electron_devices','IEEE Transactions on Electron Devices']
  ];
  const VENUE_NAMES = Object.fromEntries(VENUES);
  const TOPICS = {
    nonvolatile_memory:'Memory Device', array_system:'Memory Array', three_dimensional_memory:'3D Memory',
    in_memory_compute:'CIM / IMC', processing_in_memory:'PIM', neuromorphic_memory_computing:'Neuromorphic',
    modeling_reliability:'Modeling / Reliability', flash_charge_storage:'Flash / Charge Storage',
    ferroelectric_memory:'Ferroelectric Memory', phase_change_memory:'Phase-Change Memory',
    magnetic_memory:'Magnetic Memory', other_emerging_memory:'Other Emerging Memory'
  };
  // Empty arrays are the explicit "All" state for multi-select groups.
  const state = {scope:'all', venue:[], year:[], technology:'all', topic:[], search:''};
  let papers=[], filtered=[], shown=0, renderToken=0, loading=false;
  const searchCache=new WeakMap();
  function searchText(p) {
    if(!searchCache.has(p)) searchCache.set(p,`${p[11]} ${p[11].replace(/\s+/g,'')} ${p[2].join(' ')} ${p[10]} ${VENUE_NAMES[p[5]]||p[5]}`.toLocaleLowerCase());
    return searchCache.get(p);
  }
  function safeLink(raw) {
    try {
      const u=new URL(String(raw));
      return (u.protocol==='https:'||u.protocol==='http:') ? u.href : '';
    } catch { return ''; }
  }
  const batchSize=300;
  const TITLE_TAGS = new Set(['SUB','SUP','I','EM']);
  const $ = id => document.getElementById(id);

  // Parse publisher markup in an inert template, then copy only text and the
  // four formatting elements accepted in publication titles. No source node,
  // attribute, URL, or other element is transferred to the live document.
  function titleFragment(markup) {
    const template=document.createElement('template'); template.innerHTML=String(markup);
    const output=document.createDocumentFragment();
    function copy(source,target) {
      source.childNodes.forEach(node=>{
        if(node.nodeType===Node.TEXT_NODE) target.appendChild(document.createTextNode(node.data));
        else if(node.nodeType===Node.ELEMENT_NODE) {
          if(TITLE_TAGS.has(node.tagName)) {
            const clean=document.createElement(node.tagName.toLowerCase()); target.appendChild(clean); copy(node,clean);
          } else copy(node,target);
        }
      });
    }
    copy(template.content,output); return output;
  }

  const MULTI_KEYS = new Set(['venue','year','topic']);
  function isActive(key,value) {
    return MULTI_KEYS.has(key) ? (value==='all' ? state[key].length===0 : state[key].includes(value)) : state[key]===value;
  }
  function selectValue(key,value) {
    if(!MULTI_KEYS.has(key)) { state[key]=value; return; }
    if(value==='all') { state[key]=[]; return; }
    state[key]=state[key].includes(value) ? state[key].filter(x=>x!==value) : [...state[key],value];
  }
  function buttons(id, entries, key) {
    const root=$(id); root.textContent='';
    entries.forEach(([value,label,disabled]) => {
      const b=document.createElement('button'); b.textContent=label; b.dataset.value=value; b.disabled=!!disabled;
      const active=isActive(key,value); b.classList.toggle('active',active); b.setAttribute('aria-pressed',active);
      b.onclick=()=>{selectValue(key,value); root.querySelectorAll('button').forEach(x=>{const selected=isActive(key,x.dataset.value);x.classList.toggle('active',selected);x.setAttribute('aria-pressed',selected)}); applyFilters();};
      root.appendChild(b);
    });
  }
  function configureFilters() {
    buttons('scope',[['all','All Publications'],['candidates','NVM/PIM Candidates · provisional']],'scope');
    buttons('venue',VENUES,'venue');
    buttons('year',[['all','All'],['2026','2026'],['2025','2025'],['2024','2024'],['2023','2023']],'year');
    const technologies=[...new Set(papers.flatMap(p=>p[8]))].sort();
    buttons('technology',technologies.length?[['all','All'],...technologies.map(x=>[x,x])]:[['all','All'],['none','No structured technology tags available',true]],'technology');
    const topics=[...new Set(papers.flatMap(p=>p[9]))].sort((a,b)=>(TOPICS[a]||a).localeCompare(TOPICS[b]||b));
    buttons('topic',[['all','All'],...topics.map(x=>[x,TOPICS[x]||x])],'topic');
  }
  function applyFilters() {
    const q=state.search.trim().toLocaleLowerCase();
    filtered=papers.filter(p =>
      (state.scope==='all'||p[7]) && (!state.venue.length||state.venue.includes(p[5])) &&
      (!state.year.length||state.year.includes(String(p[4]))) && (state.technology==='all'||p[8].includes(state.technology)) &&
      (!state.topic.length||state.topic.some(topic=>p[9].includes(topic)||p[11].toLocaleLowerCase().includes((TOPICS[topic]||topic).toLocaleLowerCase()))) &&
      (!q||searchText(p).includes(q))
    );
    shown=0; renderToken++; $('results').textContent=''; $('count').textContent=`${filtered.length.toLocaleString()} ${filtered.length===1?'paper':'papers'}`;
    appendBatch(renderToken);
    // Return to the number/title start when filters, search, or Reset change.
    const scrollRegion=$('results-scroll');
    if(scrollRegion) scrollRegion.scrollLeft=0;
    updateUrl();
  }
  function appendBatch(token=renderToken) {
    if(token!==renderToken) return;
    if(!filtered.length) {
      $('rendered').textContent='';
      if(!$('results').firstChild) {
        const empty=document.createElement('div'); empty.className='empty';
        empty.textContent='0 papers match the current filters.'; $('results').appendChild(empty);
      }
      return;
    }
    if(shown>=filtered.length) return;
    const end=filtered.length<=500?filtered.length:Math.min(shown+batchSize,filtered.length), fragment=document.createDocumentFragment();
    for(let i=shown;i<end;i++) {
      const p=filtered[i], fullAuthors=p[2].join(', ')||'Authors unavailable';
      const visibleAuthors=p[2].length>3?`${p[2].slice(0,3).join(', ')} et al.`:fullAuthors;
      const tags=[...p[8],...p[9].map(x=>TOPICS[x]||x)];
      const row=document.createElement('article'); row.className='paper'; row.dataset.id=p[0];
      const title=document.createElement('div'); title.className='title-line';
      const num=document.createElement('span'); num.className='number'; num.textContent=`[${i+1}]`;
      const link=document.createElement('a'); link.appendChild(titleFragment(p[1])); const href=safeLink(p[6]); if(href){link.href=href;link.target='_blank';link.rel='noopener noreferrer'} link.title=p[11];
      title.append(num,link);
      const meta=document.createElement('div'); meta.className='meta'; meta.title=fullAuthors;
      meta.textContent=`${visibleAuthors} · ${VENUE_NAMES[p[5]]||p[5]} · ${p[3]}`;
      if(tags.length){const tag=document.createElement('span');tag.className='tag';tag.textContent=` · ${tags.join(' · ')}`;meta.appendChild(tag)}
      row.append(title,meta); fragment.appendChild(row);
    }
    shown=end; $('results').appendChild(fragment); $('rendered').textContent=shown<filtered.length?`showing ${shown.toLocaleString()}`:'';
    if(!filtered.length){const empty=document.createElement('div');empty.className='empty';empty.textContent='0 papers match the current filters.';$('results').appendChild(empty)}
  }
  function updateUrl(){const q=new URLSearchParams();Object.entries(state).forEach(([k,v])=>{if(Array.isArray(v))v.forEach(x=>q.append(k,x));else if(v&&v!=='all')q.set(k,v)});history.replaceState(null,'',q.size?`?${q}`:location.pathname)}
  function restoreUrl(){const q=new URLSearchParams(location.search);Object.keys(state).forEach(k=>{if(MULTI_KEYS.has(k))state[k]=[...new Set(q.getAll(k).filter(x=>x&&x!=='all'))];else if(q.has(k))state[k]=q.get(k)});if(!['all','candidates'].includes(state.scope))state.scope='all';$('search').value=state.search}
  function reset(){Object.assign(state,{scope:'all',venue:[],year:[],technology:'all',topic:[],search:''});$('search').value='';configureFilters();applyFilters()}
  let debounce; $('search').addEventListener('input',e=>{clearTimeout(debounce);debounce=setTimeout(()=>{state.search=e.target.value;applyFilters()},120)}); $('reset').onclick=reset;
  new IntersectionObserver(entries=>{if(entries[0].isIntersecting)appendBatch()},{rootMargin:'600px'}).observe($('sentinel'));

  const MANIFEST_URL='./data/publication-manifest.json?v=3d453476699325b8';
  const EXPECTED_COLUMNS=['id','title','authors','date','year','venue','url','candidate','technology','topic','doi','titleText'];
  async function getBytes(url, signal) {
    const response=await fetch(url,{signal,credentials:'omit'});
    if(!response.ok) throw new Error(`${response.status} ${response.statusText}: ${new URL(url,document.baseURI).pathname.split('/').pop()}`);
    return response.arrayBuffer();
  }
  async function verifyHash(bytes, expected, name) {
    if(!/^[a-f0-9]{64}$/.test(expected||'')) throw new Error(`Invalid data checksum: ${name}`);
    if(globalThis.crypto && crypto.subtle) {
      const hash=await crypto.subtle.digest('SHA-256',bytes);
      const hex=Array.from(new Uint8Array(hash),b=>b.toString(16).padStart(2,'0')).join('');
      if(hex!==expected) throw new Error(`Data checksum mismatch: ${name}`);
    }
  }
  async function decodeDataPart(packed,part) {
    // The .gz files stay compressed in the repository. No server configuration
    // or external library is required. Accept HTTP-decoded bytes as well.
    const header=new Uint8Array(packed,0,Math.min(2,packed.byteLength));
    let bytes;
    if(header[0]===0x1f && header[1]===0x8b) {
      if(packed.byteLength!==part.compressedBytes) throw new Error(`Compressed data part is incomplete: ${part.file}`);
      await verifyHash(packed,part.compressedSha256,part.file);
      if(typeof DecompressionStream!=='function') throw new Error('This browser cannot open compressed data. Use an updated Microsoft Edge, Chrome, Firefox, or Safari.');
      try {
        const stream=new Blob([packed]).stream().pipeThrough(new DecompressionStream('gzip'));
        bytes=await new Response(stream).arrayBuffer();
      } catch { throw new Error(`Cannot decompress data part: ${part.file}`); }
    } else {
      // Some static hosts/CDNs set Content-Encoding:gzip for .gz files; fetch
      // then decompresses automatically. The same plaintext hash still applies.
      bytes=packed;
    }
    if(bytes.byteLength!==part.bytes) throw new Error(`Data part is incomplete: ${part.file}`);
    await verifyHash(bytes,part.sha256,part.file);
    return bytes;
  }
  function parseJson(bytes,name) {
    try { return JSON.parse(new TextDecoder('utf-8',{fatal:true}).decode(bytes)); }
    catch { throw new Error(`Invalid JSON: ${name}. Upload every file from the same package.`); }
  }
  function setLoading(message) {
    $('coverage').textContent=message;
    const node=$('results').firstElementChild;
    if(node && node.classList.contains('loading')) node.textContent=message;
  }
  async function loadPublicationIndex() {
    if(loading) return;
    loading=true;
    const controller=new AbortController();
    $('search').disabled=true; $('reset').disabled=true;
    $('count').textContent='Loading…'; $('rendered').textContent='';
    $('results').replaceChildren();
    const loadingNode=document.createElement('div'); loadingNode.className='loading';
    $('results').appendChild(loadingNode);
    try {
      if(location.protocol==='file:') throw new Error('Open the deployed GitHub Pages address. This split-data page needs HTTP or HTTPS, not a double-clicked file.');
      setLoading('Loading publication inventory…');
      const manifestUrl=new URL(MANIFEST_URL,document.baseURI);
      const data=parseJson(await getBytes(manifestUrl,controller.signal),'publication-manifest.json');
      if(data.format!=='paperclipper-census-gzip-chunks-v2'||JSON.stringify(data.columns)!==JSON.stringify(EXPECTED_COLUMNS)) throw new Error('Unsupported publication data format.');
      if(!Array.isArray(data.parts)||!data.parts.length||!Number.isSafeInteger(data.canonicalCount)||data.canonicalCount<0) throw new Error('Incomplete publication manifest.');
      if(!Number.isSafeInteger(data.candidateCount)||data.candidateCount<0||data.parts.reduce((n,p)=>n+p.count,0)!==data.canonicalCount) throw new Error('Manifest totals do not agree.');
      const chunks=new Array(data.parts.length);
      let next=0,finished=0,loadedCount=0;
      async function worker() {
        while(next<data.parts.length) {
          const index=next++, part=data.parts[index];
          if(!/^publications-\d{3}\.[a-f0-9]{12}\.json\.gz$/.test(part.file) || part.encoding!=='gzip') throw new Error('Unexpected data part path or encoding.');
          if(!Number.isSafeInteger(part.bytes) || part.bytes<=0 || part.bytes>16*1024*1024 || !Number.isSafeInteger(part.compressedBytes) || part.compressedBytes<=0) throw new Error('Invalid data part sizes.');
          const packed=await getBytes(new URL(part.file,manifestUrl),controller.signal);
          const bytes=await decodeDataPart(packed,part);
          const chunk=parseJson(bytes,part.file);
          if(!Array.isArray(chunk)||chunk.length!==part.count) throw new Error(`Data part count mismatch: ${part.file}`);
          chunks[index]=chunk; finished++; loadedCount+=chunk.length;
          setLoading(`Loading ${loadedCount.toLocaleString()} / ${data.canonicalCount.toLocaleString()} publications · ${finished}/${data.parts.length} files`);
        }
      }
      await Promise.all(Array.from({length:Math.min(3,data.parts.length)},worker));
      const combined=new Array(data.canonicalCount), ids=new Set();
      let offset=0,candidateTotal=0;
      for(const chunk of chunks) {
        for(const p of chunk) {
          if(!Array.isArray(p)||p.length!==EXPECTED_COLUMNS.length||typeof p[0]!=='string'||typeof p[1]!=='string'||!Array.isArray(p[2])||!Array.isArray(p[8])||!Array.isArray(p[9])||typeof p[11]!=='string'||typeof p[7]!=='boolean') throw new Error('Malformed publication record.');
          if(ids.has(p[0])) throw new Error('Duplicate publication ID. Upload all data parts from the same package.');
          if(!Object.prototype.hasOwnProperty.call(data.venueCoverage,p[5])) throw new Error('Unknown venue in publication data.');
          ids.add(p[0]); if(p[7]) candidateTotal++; combined[offset++]=p;
        }
      }
      if(offset!==data.canonicalCount||candidateTotal!==data.candidateCount) throw new Error('Publication/candidate totals do not match the manifest.');
      // Preserve source order exactly (latest first); part requests may finish
      // in any order but they are joined in manifest order, never arrival order.
      papers=combined;
      const baseNames=Object.fromEntries(VENUES);
      VENUES=VENUES.map(([id,label])=>[id,id==='all'?label:`${label}${data.venueCoverage[id]&&data.venueCoverage[id]!=='NORMAL'?` · ${data.venueCoverage[id]}`:''}`]);
      Object.assign(VENUE_NAMES,baseNames,Object.fromEntries(VENUES));
      const periodNode=document.getElementById('period-label');
      if(periodNode) periodNode.textContent=`${data.status||'PROVISIONAL'} · ${data.collectionStart||'2023-10-01'}–${data.collectionCutoff||'2026-09-30'}`;
      restoreUrl(); configureFilters();
      const warningSummary=Object.entries(data.coverageCounts).filter(([status])=>status!=='NORMAL').sort().map(([status,count])=>`${count} ${status}`).join(' · ');
      $('coverage').textContent=`${data.canonicalCount.toLocaleString()} publications · ${Object.keys(data.venueCoverage).length} venues${warningSummary?` · ${warningSummary}`:''}`;
      $('search').disabled=false; $('reset').disabled=false;
      applyFilters();
      document.body.dataset.ready='true';
    } catch(err) {
      controller.abort();
      $('coverage').textContent='Inventory not loaded'; $('count').textContent='Unavailable';
      $('results').replaceChildren();
      const error=document.createElement('div'); error.className='empty'; error.setAttribute('role','alert');
      error.textContent=`Could not load the complete inventory: ${err.message||String(err)} `+
        'Make sure index.html, app.js, and the entire data folder from the same ZIP are uploaded together.';
      const retry=document.createElement('button'); retry.type='button'; retry.textContent='Retry';
      retry.addEventListener('click',loadPublicationIndex);
      $('results').append(error,retry);
    } finally { loading=false; }
  }
  loadPublicationIndex();

})();
