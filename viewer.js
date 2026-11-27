const BASE = new URL('./assets/viewer/', import.meta.url);
const bedroom = [
  {name: 'obj_0_part_2', label: 'Left door'},
  {name: 'obj_0_part_1', label: 'Right door'},
  {name: 'obj_1_part_1', label: 'Drawer'}
];
const scenes = {
  bedroom,
  kitchen: [
    {name:'obj_0_part_1', label:'Fridge door'},
    {name:'obj_1_part_1', label:'Sideboard door 1'},
    {name:'obj_1_part_2', label:'Sideboard drawer'},
    {name:'obj_1_part_3', label:'Sideboard door 2'}
  ],
  study: [
    {name:'obj_0_part_1', label:'Credenza door 1'},
    {name:'obj_0_part_2', label:'Credenza door 2'},
    ...Array.from({length:5}, (_, i) => ({name:'obj_2_part_'+(i+1), label:'Desk drawer '+(i+1)}))
  ],
  entryway: [
    {name:'obj_0_part_1', label:'Cabinet door 1'},
    {name:'obj_0_part_2', label:'Cabinet door 2'},
    {name:'obj_1_part_1', label:'Trunk lid'}
  ],
  'scene-03': [
    {name:'obj_0_part_1', label:'Washer door'},
    {name:'obj_1_part_1', label:'Cabinet door 1'},
    {name:'obj_1_part_2', label:'Cabinet door 2'},
    {name:'obj_2_part_1', label:'Hamper lid'}
  ],
  'scene-05': [
    {name:'obj_0_part_1', label:'Console door 1'},
    {name:'obj_0_part_2', label:'Console door 2'},
    {name:'obj_1_part_1', label:'Ottoman lid'}
  ],
  'scene-07': [
    {name:'obj_0_part_1', label:'Laptop screen'},
    {name:'obj_1_part_1', label:'Printer lid'}
  ],
  'scene-08': [
    {name:'obj_0_part_1', label:'Toaster oven door'},
    {name:'obj_1_part_1', label:'Microwave door'}
  ],
  'scene-09': [
    {name:'obj_0_part_1', label:'Grill lid'},
    {name:'obj_1_part_1', label:'Cooler lid'}
  ]
};

class RiseViewer extends HTMLElement {
  connectedCallback() {
    if (this.shadowRoot) return;
    const root = this.attachShadow({mode:'open'});
    this.room = this.dataset.room || 'bedroom';
    this.roomName = this.dataset.title || this.room;
    this.request = new AbortController();
    root.innerHTML = view(this.roomName);
    this.status = root.querySelector('[role=status]');
    this.stage = root.querySelector('.stage');
    const start = () => {
      if (!this.loading) this.loading = this.load().catch(error => {
        if (this.request.signal.aborted) return;
        this.status.hidden = false;
        this.status.textContent = 'The 3D scene could not load. Select Retry, or use a browser with WebGL 2.';
        this.stage.classList.remove('ready');
        root.querySelector('.retry').hidden = false;
        console.warn(this.room+' viewer:', error);
        this.loading = null;
      });
    };
    root.querySelector('.retry').onclick = () => {root.querySelector('.retry').hidden = true;start()};
    const observer = new IntersectionObserver(entries => {
      if (entries.some(entry => entry.isIntersecting)) {observer.disconnect();start()}
    }, {rootMargin:'120px'});
    this.visibilityObserver=observer;
    observer.observe(this);
  }

  disconnectedCallback() {
    this.request.abort();
    this.visibilityObserver?.disconnect();
    this.dispose?.();
  }

  async load() {
    const root = this.shadowRoot;
    this.status.textContent = 'Loading '+this.roomName+'…';
    const fetchAsset = async name => {
      const response = await fetch(new URL(name, BASE), {signal:this.request.signal});
      if (!response.ok) throw Error(name+' returned '+response.status);
      return response;
    };
    const [T,{GLTFLoader},{OrbitControls},{MeshoptDecoder},motion,model] = await Promise.all([
      import(new URL('three.module.min.js',BASE)), import(new URL('GLTFLoader.js',BASE)),
      import(new URL('OrbitControls.js',BASE)),
      import(new URL('meshopt_decoder.module.js',BASE)),
      fetchAsset(this.room==='bedroom'?'joints.json':this.room+'-joints.json').then(r=>r.json()),
      fetchAsset(this.room+'.glb').then(r=>r.arrayBuffer())
    ]);
    if (!this.isConnected) return;
    const gltf = await new GLTFLoader().setMeshoptDecoder(MeshoptDecoder).parseAsync(model,BASE.href);
    if(!this.isConnected)return;
    const renderer = new T.WebGLRenderer({antialias:true,alpha:false,powerPreference:'low-power'});
    renderer.setPixelRatio(Math.min(1.7,window.devicePixelRatio||1));
    renderer.shadowMap.enabled=false;
    renderer.shadowMap.type=T.PCFSoftShadowMap;
    const canvas=renderer.domElement;
    canvas.setAttribute('aria-label',this.roomName+'. Drag a movable part right to open it, or drag the background to orbit.');
    this.stage.prepend(canvas);
    const scene=new T.Scene();
    scene.background=new T.Color(0xeae6df);
    scene.add(gltf.scene);
    gltf.scene.updateMatrixWorld(true);
    const bounds=new T.Box3().setFromObject(gltf.scene);
    const center=bounds.getCenter(new T.Vector3());
    const size=bounds.getSize(new T.Vector3());
    const span=Math.max(size.x,size.y,size.z);
    const camera=new T.PerspectiveCamera(31,1,span/100,span*30);
    const orbit=new OrbitControls(camera,canvas);
    orbit.enablePan=false;
    orbit.enableZoom=true;
    orbit.minDistance=span*.35;orbit.maxDistance=span*3.8;
    orbit.maxPolarAngle=Math.PI*.49;
    const ambient=new T.HemisphereLight(0xffffff,0xd4c7b7,1.65);
    const key=new T.DirectionalLight(0xfff3dd,2.1);
    key.position.copy(center).add(new T.Vector3(-span,span*1.9,-span));
    key.target.position.copy(center);
    key.castShadow=true;
    key.shadow.mapSize.set(1024,1024);
    Object.assign(key.shadow.camera,{left:-span,right:span,top:span,bottom:-span,near:.01,far:span*6});
    key.shadow.normalBias=span*.0003;
    scene.add(ambient,key,key.target);
    const floor=new T.Mesh(new T.PlaneGeometry(span*35,span*35), new T.MeshStandardMaterial({color:0xdfd9ce,roughness:1}));
    floor.rotation.x=-Math.PI/2;floor.position.y=bounds.min.y-.003;floor.receiveShadow=true;scene.add(floor);scene.fog=new T.Fog(scene.background,span*2.8,span*9);
    const shade=document.createElement('canvas');shade.width=shade.height=128;
    const ctx=shade.getContext('2d'), gradient=ctx.createRadialGradient(64,64,0,64,64,64);
    gradient.addColorStop(0,'rgba(65,52,41,.22)');gradient.addColorStop(.48,'rgba(65,52,41,.10)');gradient.addColorStop(1,'rgba(65,52,41,0)');
    ctx.fillStyle=gradient;ctx.fillRect(0,0,128,128);
    const patch=new T.MeshBasicMaterial({map:new T.CanvasTexture(shade),transparent:true,depthWrite:false});
    for(const name of ['obj_0_part_0','obj_1_part_0','obj_2_part_0','obj_3_part_0','obj_4_part_0','obj_5_part_0']){
      const object=gltf.scene.getObjectByName(name);if(!object)continue;
      const box=new T.Box3().setFromObject(object), extent=box.getSize(new T.Vector3()),pos=box.getCenter(new T.Vector3());
      const contact=new T.Mesh(new T.PlaneGeometry(extent.x*1.35,extent.z*1.35),patch);
      contact.rotation.x=-Math.PI/2;contact.position.set(pos.x,Math.max(floor.position.y+.001,box.min.y-.002),pos.z);scene.add(contact);
    }
    const counts={revolute:0,prismatic:0};
    // Keep the third dining-room slide static in the interactive presentation.
    const definitions=scenes[this.room] || motion
      .filter(joint => this.room !== 'figure6-3' || joint.node_name !== 'obj_4_part_1')
      .map(joint=>({
        name:joint.node_name,
        label:(joint.type==='revolute'?'Hinge ':'Slide ')+(++counts[joint.type]),
        joint
      }));
    const parts=definitions.map(({name,label,joint})=>{
      const node=gltf.scene.getObjectByName(name);
      if(!node)throw Error('Missing part '+name);
      const part={name,label,node,base:node.matrixWorld.clone(),value:0};
      if(joint){
        const axis=new T.Vector3(...joint.world_direction).normalize(),pivot=new T.Vector3(...joint.world_origin);
        part.transform=fraction=>{
          const amount=joint.range[1]*fraction;
          if(joint.type==='prismatic')return new T.Matrix4().makeTranslation(axis.clone().multiplyScalar(amount));
          const rotation=new T.Matrix4().makeRotationAxis(axis,amount);
          return rotation.setPosition(pivot.clone().sub(pivot.clone().applyMatrix4(rotation)));
        };
        return part;
      }
      const samples=motion[name].map(a=>{
        const m=new T.Matrix4().fromArray(a),p=new T.Vector3(),q=new T.Quaternion();
        m.decompose(p,q,new T.Vector3());return {p,q};
      });
      part.transform=fraction=>{
        const t=fraction*(samples.length-1),lo=Math.floor(t),hi=Math.min(lo+1,samples.length-1);
        const a=samples[lo],b=samples[hi];
        return new T.Matrix4().compose(a.p.clone().lerp(b.p,t-lo),a.q.clone().slerp(b.q,t-lo),new T.Vector3(1,1,1));
      };
      return part;
    });
    const activeMeshes=new Map();
    parts.forEach((part,i)=>part.node.traverse(o=>{if(o.isMesh)activeMeshes.set(o,i)}));
    const meshes=[];
    gltf.scene.traverse(o=>{
      if(!o.isMesh)return; meshes.push(o);o.castShadow=true;o.receiveShadow=true;
      for(const material of [].concat(o.material)){if(material.map){material.metalness=0;material.roughness=.82}}
      if(activeMeshes.has(o))o.material=Array.isArray(o.material)?o.material.map(m=>m.clone()):o.material.clone();
    });
    const draw=()=>renderer.render(scene,camera);
    orbit.addEventListener('change',draw);
    const resetView=()=>{
      const distance=Math.max(size.y*1.35,size.x/(camera.aspect||1),size.z*.73)*.57/Math.tan(T.MathUtils.degToRad(15.5))+size.z*.20;
      orbit.target.copy(center);
      camera.position.copy(center).addScaledVector(new T.Vector3(.045,.12,-1).normalize(),distance);
      orbit.update();draw();
    };
    const restored=this.initialState;
    let previousWidth=0;
    const sizeObserver=new ResizeObserver(()=>{
      const w=this.stage.clientWidth,h=this.stage.clientHeight;
      if(!w||!h)return;
      renderer.setSize(w,h,false);camera.aspect=w/h;camera.updateProjectionMatrix();
      if(!previousWidth && restored?.camera){
        camera.position.fromArray(restored.camera);orbit.target.fromArray(restored.target);orbit.update();draw();
      }else if(previousWidth!==w)resetView();else draw();
      previousWidth=w;
    });
    sizeObserver.observe(this.stage);
    this.dispose=()=>{
      sizeObserver.disconnect();orbit.dispose();
      const resources=new Set();
      scene.traverse(o=>{if(o.geometry)resources.add(o.geometry);for(const m of [].concat(o.material||[])){resources.add(m);for(const val of Object.values(m))if(val?.isTexture)resources.add(val);}});
      for(const resource of resources)resource.dispose();
      renderer.dispose();renderer.forceContextLoss();
    };
    const buttons=parts.map(({label})=>{
      const b=document.createElement('button');b.type='button';b.className='part';b.textContent=label;return b;
    });
    root.querySelector('.parts').replaceChildren(...buttons);
    const input=root.querySelector('input'), output=root.querySelector('output');
    let selected=0;
    const select=i=>{
      selected=i;buttons.forEach((b,k)=>b.setAttribute('aria-pressed',String(i===k)));
      activeMeshes.forEach((k,mesh)=>{for(const m of [].concat(mesh.material)){if(m.emissive)m.emissive.setHex(k===i?0x27352c:0)}});
      input.value=String(parts[i].value);input.setAttribute('aria-label',parts[i].label+' opening');
      output.value=input.value+'%';draw();
    };
    buttons.forEach((b,i)=>b.onclick=()=>select(i));
    const posePart=(part,value)=>{
      part.value=value;
      const delta=part.transform(value/100);
      const local=part.node.parent.matrixWorld.clone().invert().multiply(delta).multiply(part.base);
      local.decompose(part.node.position,part.node.quaternion,part.node.scale);
      part.node.updateMatrixWorld(true);
    };
    input.oninput=()=>{
      const value=Number(input.value);
      posePart(parts[selected],value);output.value=value+'%';draw();
    };
    let drag=null;
    canvas.addEventListener('pointerdown',e=>{
      if(e.button!==0||!e.isPrimary)return;
      const box=canvas.getBoundingClientRect();
      const ray=new T.Raycaster();ray.setFromCamera(new T.Vector2(2*(e.clientX-box.left)/box.width-1,1-2*(e.clientY-box.top)/box.height),camera);
      const hit=ray.intersectObjects(meshes,false)[0];if(!hit||!activeMeshes.has(hit.object))return;
      select(activeMeshes.get(hit.object));
      e.stopImmediatePropagation();canvas.setPointerCapture(e.pointerId);orbit.enabled=false;
      drag={id:e.pointerId,x:e.clientX,start:parts[selected].value,distance:Math.max(90,box.width*.28)};
      canvas.style.cursor='grabbing';
    },true);
    canvas.addEventListener('pointermove',e=>{
      if(!drag||e.pointerId!==drag.id)return;
      input.value=String(Math.max(0,Math.min(100,Math.round(drag.start+(e.clientX-drag.x)*100/drag.distance))));
      input.oninput();
    });
    const endDrag=e=>{
      if(drag?.id!==e.pointerId)return;
      drag=null;orbit.enabled=true;canvas.style.cursor='';
      if(canvas.hasPointerCapture(e.pointerId))canvas.releasePointerCapture(e.pointerId);
    };
    for(const event of ['pointerup','pointercancel','lostpointercapture'])canvas.addEventListener(event,endDrag);
    root.querySelector('.reset').onclick=resetView;
    root.querySelector('fieldset').disabled=false;
    this.status.hidden=true;this.stage.classList.add('ready');
    for(const part of parts){
      const value=restored?.openings[part.name];
      if(value)posePart(part,value);
    }
    select(restored?.selected ?? 0);
    this.captureState=()=>({
      openings:Object.fromEntries(parts.map(part=>[part.name,part.value])),
      selected,
      camera:previousWidth?camera.position.toArray():undefined,
      target:orbit.target.toArray()
    });
  }
}
const STYLE = `:host{display:block;color:#172a29;font:inherit}*{box-sizing:border-box}.stage{position:relative;isolation:isolate;display:grid;place-items:center;width:100%;max-height:var(--stage-cap,none);aspect-ratio:1.69;overflow:hidden;background:#e8e3da var(--preview, url("${new URL('bedroom.webp',BASE).href}")) center/cover no-repeat}.stage canvas{width:100%;height:100%;position:absolute;inset:0;visibility:hidden;touch-action:none}.ready canvas{visibility:visible}.stage [role=status]{position:absolute;left:12px;bottom:12px;padding:7px 12px;background:#fffc;color:#253835;font-size:calc(.86rem * var(--type-scale, 1));max-width:calc(100% - 24px)}[hidden]{display:none!important}.retry{position:relative}fieldset{min-inline-size:0;margin:0;border:1px solid #d8dfda;border-top:0;padding:14px 16px 12px;background:white}legend{position:absolute;width:1px;height:1px;clip-path:inset(50%);overflow:hidden}button,input{font:inherit}.bar,.parts,.slider{display:flex;align-items:center}.bar{flex-wrap:wrap;justify-content:space-between;gap:8px}.parts{flex-wrap:wrap;gap:4px}button{color:inherit;cursor:pointer;background:transparent;border:1px solid #b8c5be;padding:7px 10px;font-size:calc(.87rem * var(--type-scale, 1));border-radius:4px}button[aria-pressed=true]{background:#183e37;color:white;border-color:#183e37}.reset{border-color:transparent;text-decoration:underline;text-underline-offset:3px}.slider{margin-top:14px;gap:10px;font-size:calc(.85rem * var(--type-scale, 1));color:#40544f}.slider input{flex:1;min-width:32px;accent-color:#24594c}.slider output{width:3em;text-align:right;font-variant-numeric:tabular-nums}@media(max-width:500px){fieldset{padding:10px}.stage{aspect-ratio:1.35}.bar{flex-wrap:wrap}button{padding:7px 8px}}`;
const view = room => '<style>'+STYLE+'</style><div class="stage"><span role="status">Loading interactive '+room+'…</span><button class="retry" hidden>Retry</button></div><fieldset disabled><legend>'+room+' joints</legend><div class="bar"><div class="parts"></div><button type="button" class="reset">Reset view</button></div><label class="slider">Closed<input type="range" min="0" max="100" value="0" step="1"><span>Open</span><output>0%</output></label></fieldset>';
customElements.define('rise-viewer',RiseViewer);
