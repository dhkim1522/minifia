(function () {
  "use strict";

  const root = document.getElementById("mf8");
  const byId = id => root.querySelector("#mf8-" + id);
  const world = byId("world");
  const preview = byId("preview");
  const controls = byId("controls");
  const chapter = byId("chapter");
  const artRoot = "../../../public/";
  const files = ["fig1_boy_brown", "fig2_boy_black", "fig3_boy_blonde", "fig4_girl_brown",
    "fig5_girl_black", "fig6_girl_auburn", "fig7_boy_blackhat", "fig8_girl_tanhat"];
  const art = {
    room: artRoot + "maps/map-bar.png",
    figures: files.map(f => artRoot + "characters/table/" + f + "_default@4x.png"),
    faces: files.map((_, i) => artRoot + "characters/faces/face-" + i + ".png")
  };
  const names = ["지호", "민준", "서연", "도윤", "하린", "유진", "현우", "수아"];
  const field = [[22,69],[50,31],[72,49],[33,42],[88,68],[49,86],[12,91],[77,90]];
  const layouts = {
    4:[[31,48],[69,48],[82,79],[18,79]],
    5:[[17,46],[50,38],[83,46],[70,89],[30,89]],
    6:[[17,46],[50,38],[83,46],[80,85],[50,92],[20,85]],
    7:[[12,46],[37,39],[63,39],[88,46],[81,85],[50,92],[19,85]],
    8:[[12,46],[37,39],[63,39],[88,46],[86,85],[63,92],[37,92],[14,85]]
  };
  const scenes = [
    ["메인 첫 화면","미니피아","친구 4~8명이 모여 마피아를 찾는 재즈 바"],
    ["첫날 · 자유 이동","재즈 바에 모인 사람들","바닥을 눌러 걷거나 친구를 눌러 다가가세요."],
    ["자동 집결","테이블로 모이는 중","모두 자기 자리로 이동해요."],
    ["첫날 · 잠정 지목","누가 의심되나요?","좌석을 눌러 공개 의심을 표시해요. 오늘은 탈락이 없어요."],
    ["첫째 밤 · 시민 시점","재즈 바의 불이 꺼졌어요","지호는 시민이에요. 아침이 되면 다시 만나요."],
    ["둘째 날 · 아침 발표","도윤이 탈락했어요","모두 테이블에서 밤사이 있었던 일을 들어요."],
    ["둘째 날 · 자유 대화","다시 이야기할 시간","어제의 지목이 궁금한 친구에게 다가가 보세요."],
    ["둘째 날 · 공식 토론","어제의 지목을 되짚어요","자리는 고정돼요. 발언과 반응은 계속할 수 있어요."],
    ["둘째 날 · 투표","누구에게 투표할까요?","아래에서 후보를 고른 뒤 표를 확정하세요."],
    ["투표 접수","내 표를 냈어요","남은 플레이어가 투표하고 있어요."]
  ];
  const notes = [
    ["같은 얼굴로 입장","포스터의 인물은 방에서 만날 실제 캐릭터입니다."],
    ["움직여 보세요","내 캐릭터는 지호입니다. 첫 이동부터 20초 뒤 자동으로 집결합니다. ‘다음 장면’으로 집결을 앞당길 수 있습니다."],
    ["모이는 순간","흩어져 있던 인물이 자기 좌석으로 걸어갑니다. 모두 도착하면 공식 단계가 열립니다."],
    ["잠정 지목은 거둘 수 있어요","첫날은 한 명에게 의심을 표시하는 단계입니다. 실제 표결은 둘째 날에 진행합니다."],
    ["밤 행동은 비공개","공개 필드를 어둡게 감춥니다. 다른 사람의 이동이나 선택은 보이지 않습니다."],
    ["도윤의 자리를 기억하세요","밤사이 탈락한 도윤의 이름과 빈자리를 남깁니다. 다른 사람의 자리는 그대로입니다."],
    ["집결 뒤 다시 풀리는 필드","공개 대화는 바 어디에서나 읽을 수 있습니다. 다시 움직이면 20초 뒤 공식 토론으로 모입니다."],
    ["누가 말했는지 확인하세요","발언자의 얼굴과 말을 아래에 함께 보여줍니다. 토론 종료 요청을 눌러도 특정인에게 표가 들어가지 않습니다."],
    ["인원과 후보 수를 비교하세요","8명으로 시작하면 생존자는 7명입니다. 나는 투표에 참여하고, 나머지 6명이 내가 고를 수 있는 후보입니다."],
    ["확정 뒤에는 기다려요","‘다시 투표해 보기’로 다른 후보를 골라 화면을 비교할 수 있습니다."]
  ];
  const state = {scene:1,count:8,focus:null,mark:null,pick:null,vote:null,request:false,remark:false,
    messages:{},drafts:{},positions:[],join:false,targetScene:3,remaining:null};
  let timer = null;
  const make = (tag,cls,txt) => {
    const n=document.createElement(tag);
    if(cls)n.className=cls;
    if(txt!==undefined)n.textContent=txt;
    return n;
  };
  function button(text, cls, action) {
    const n=make("button",cls,text); n.type="button"; n.addEventListener("click",action);return n;
  }
  function photo(src,cls,alt) {
    const n=make("img",cls);n.src=src;n.alt=alt;return n;
  }
  const ids=()=>Array.from({length:state.count},(_,i)=>i);
  const isFree=()=>state.scene===1||state.scene===6;
  const dayTwo=()=>state.scene>=5 || (state.scene===2 && state.targetScene===7);
  const resetPositions=()=>{state.positions=field.map(p=>p.slice())};
  const seated=()=>![1,6].includes(state.scene);
  const folded=root.querySelector(".comparison");
  if(root.getBoundingClientRect().width<640)folded.open=false;
  scenes.forEach((s,i)=>chapter.add(new Option(s[0],i)));

  function stopClock(){
    clearInterval(timer);timer=null;state.remaining=null;
  }
  function phaseLabel(){
    const day=dayTwo()?"둘째 날":"첫째 날";
    if(state.scene===0)return "친구 4~8명";
    const crowd=dayTwo()?(state.count-1)+"명 생존":state.count+"명";
    const remaining=state.remaining===null?"":" · "+state.remaining+"초";
    return day+" · "+crowd+remaining;
  }
  function startClock(){
    if(timer||!isFree())return;
    state.remaining=20;byId("phase").textContent=phaseLabel();
    timer=setInterval(()=>{
      state.remaining--;byId("phase").textContent=phaseLabel();
      if(state.remaining<=0)assemble(state.scene===1?3:7);
    },1000);
  }
  function position(n,point){n.style.left=point[0]+"%";n.style.top=point[1]+"%"}
  function paintWorld(stage,close,reference){
    const dead=dayTwo() && state.scene!==0;
    const night=state.scene===4 && !reference;
    stage.className="world "+(close?"seated ":"")+(night?"night ":"")+
      (state.scene===0&&!reference?"homeview ":"")+(state.count===4?"four":state.count<=6?"medium":"large");
    stage.style.setProperty("--columns",String(Math.ceil(state.count/2)));
    stage.style.setProperty("--room","url("+art.room+")");
    stage.replaceChildren(make("div","room"),make("div","booth"),make("div","light"));
    if(night)return;
    ids().forEach(i=>{
      if(dead&&i===3&&!close)return;
      const movable=!reference&&isFree();
      const selectable=!reference&&state.scene===3&&i!==0;
      const role=dead&&i===3?" · 탈락":i===0?" · 나":"";
      const actor=(movable||selectable)?button("","actor",ev=>{
        ev.stopPropagation();
        if(selectable){state.pick=i;render();return}
        if(i!==0)walkTo([state.positions[i][0]+(state.positions[i][0]>73?-12:12),state.positions[i][1]+4],i);
      }):make("div","actor");
      actor.dataset.person=i;actor.classList.toggle("front",i>=Math.ceil(state.count/2));actor.classList.toggle("right",layouts[state.count][i][0]>50);actor.setAttribute("aria-label",names[i]+role);
      actor.classList.toggle("me",i===0);
      actor.classList.toggle("dead",dead&&i===3);
      actor.classList.toggle("picked",!reference&&((state.scene===3||state.scene===8)&&state.pick===i));
      actor.classList.toggle("speaker",!reference&&state.scene===7&&i===(state.messages[7]?0:1));
      actor.append(photo(art.figures[i],"doll",""),make("span","nametag",names[i]+role));
      position(actor,close?layouts[state.count][i]:state.positions[i]);
      stage.append(actor);
    });
  }
  function walkTo(point,friend){
    if(!isFree())return;
    const me=world.querySelector('[data-person="0"]');
    state.focus=friend;
    startClock();
    MfWalk.move(world,me,point,()=>{
      state.positions[0]=[parseFloat(me.style.left),parseFloat(me.style.top)];
    });
    paintControls();
  }
  world.addEventListener("click",ev=>{
    if(!isFree()||ev.target.closest(".actor"))return;
    const r=world.getBoundingClientRect();
    walkTo([(ev.clientX-r.left)*100/r.width,(ev.clientY-r.top)*100/r.height],null);
  });
  world.addEventListener("keydown",ev=>{
    const steps={ArrowLeft:[-9,0],ArrowRight:[9,0],ArrowUp:[0,-9],ArrowDown:[0,9]};
    if(!isFree()||!steps[ev.key])return;
    ev.preventDefault();
    const p=state.positions[0],d=steps[ev.key];walkTo([p[0]+d[0],p[1]+d[1]],null);
  });
  function assemble(target){
    const me=world.querySelector('[data-person="0"]');
    if(isFree()&&me)state.positions[0]=[parseFloat(me.style.left),parseFloat(me.style.top)];
    MfWalk.cancel(world);stopClock();state.targetScene=target;state.scene=2;state.focus=null;
    render();
    const actors=Array.from(world.querySelectorAll(".actor"));
    void world.offsetHeight;
    world.classList.add("assembling");
    MfWalk.gather(world,actors,actors.map(a=>layouts[state.count][Number(a.dataset.person)]),()=>enter(target));
  }
  function enter(i){
    if(i===2){assemble(3);return}
    if(i===7&&state.scene===6){assemble(7);return}
    MfWalk.cancel(world);stopClock();
    state.scene=i;state.focus=null;state.join=false;
    if(i===1||i===6)resetPositions();
    state.pick=i===3?state.mark:i===8?state.vote:null;
    render();
  }
  function advance(){
    if(state.scene===1){assemble(3);return}
    if(state.scene===2){enter(state.targetScene);return}
    if(state.scene===6){assemble(7);return}
    if(state.scene===8&&state.vote===null)return;
    if(state.scene<9)enter(state.scene+1);
  }
  function say(i,txt){
    const speech=make("div","speech");
    const body=make("div");body.append(make("span","who",names[i]+(i===0?" · 나":"")),document.createTextNode(txt));
    speech.append(photo(art.faces[i],"face",""),body);return speech;
  }
  function sendRow(){
    const row=make("div","sendrow"),input=make("input");
    input.placeholder="공개 발언 입력";input.setAttribute("aria-label","공개 발언");input.maxLength=120;input.value=state.drafts[state.scene]||"";
    input.addEventListener("input",()=>{state.drafts[state.scene]=input.value});
    function send(){if(!input.value.trim())return;state.messages[state.scene]=input.value.trim();state.drafts[state.scene]="";paintControls();
      if(state.scene===7)paintWorld(world,true,false)}
    input.addEventListener("keydown",ev=>{if(ev.key==="Enter"&&!ev.isComposing){ev.preventDefault();send()}});
    row.append(input,button("보내기","quiet",send));return row;
  }
  function picker(){
    const pool=make("div","ballot");
    const cols=Math.ceil(state.count/2),order=ids();
    const rows=[order.slice(0,cols),order.slice(cols).reverse()];
    pool.style.setProperty("--cols",String(cols));
    rows.forEach(row=>row.forEach(i=>{
      const eligible=i!==0&&i!==3;
      const b=eligible?button("","candidate",()=>{state.pick=i;render()}):make("div","candidate unavailable");
      if(eligible)b.setAttribute("aria-pressed",String(state.pick===i));
      const label=names[i]+(i===0?" · 나":i===3?" · 탈락":"");
      b.append(photo(art.faces[i],"face",""),make("span","",label));pool.append(b);
    }));
    return pool;
  }
  function paintControls(){
    const s=state.scene;
    controls.replaceChildren();
    if(s===0){
      if(!state.join){controls.append(button("방 만들기","action",()=>enter(1)),button("코드로 참가","quiet",()=>{state.join=true;paintControls()}));return}
      const input=make("input","code"),msg=make("span","muted","시안 방 코드　JAZZ");
      input.placeholder="방 코드";input.setAttribute("aria-label","방 코드");
      const join=()=>{if(input.value.trim().toUpperCase()==="JAZZ")enter(1);else msg.textContent="시안에서는 JAZZ를 입력하세요."};
      controls.append(msg,input,button("참가하기","action",join),button("닫기","quiet",()=>{state.join=false;paintControls()}));return;
    }
    if(isFree()){
      const friend=state.focus;
      controls.append(make("span","pickhint",friend===null?"자유 이동 · 바닥 또는 친구 선택":names[friend]+" 쪽으로 이동 · 대화는 모두에게 공개"));
      const line=state.messages[s];
      controls.append(line?say(0,line):s===1?say(2,"도윤, 오늘은 왜 이렇게 조용해?"):say(1,"서연, 어제 도윤을 지목한 이유가 있어?"),sendRow());
      return;
    }
    if(s===2){controls.append(make("strong","","자동 집결 중"),make("p","muted","모두 도착하면 테이블에서 이야기를 이어가요."));return}
    if(s===3){
      controls.append(say(2,"나는 도윤이 조금 의심돼."),make("span","muted","내 공개 지목　"+(state.mark===null?"아직 없음":names[state.mark])));
      const undo=state.mark!==null&&state.pick===state.mark;
      const b=button(undo?"의심 표시 거두기":state.pick===null?"테이블에서 사람 선택":names[state.pick]+" 의심 표시","action",()=>{
        state.mark=undo?null:state.pick;state.pick=state.mark;render()});
      b.disabled=state.pick===null;controls.append(b);return;
    }
    if(s===4){controls.append(make("strong","","나의 역할 · 시민"),make("p","muted","밤 행동이 끝나기를 기다리고 있어요."));return}
    if(s===5){controls.append(make("strong","","도윤 · 탈락　/　역할 비공개"),button("대화하러 가기","action",()=>enter(6)));return}
    if(s===7){
      controls.append(say(state.messages[7]?0:1,state.messages[7]||"서연, 어제 도윤을 지목한 이유가 있어?"),say(2,"조용해서 물어본 거야."),sendRow());
      const row=make("div","twobtn");row.append(button(state.remark?"끄덕였어요 ✓":"고개 끄덕이기","quiet",()=>{state.remark=!state.remark;paintControls();
        const doll=world.querySelector(".me .doll");if(doll&&doll.animate&&!matchMedia("(prefers-reduced-motion: reduce)").matches)doll.animate([{transform:"rotate(0deg)"},{transform:"rotate(8deg)"},{transform:"rotate(0deg)"}],{duration:350})}),
        button((state.request?"종료 요청 취소 · 1/":"토론 마치기 요청 · 0/")+(state.count-1),"quiet",()=>{state.request=!state.request;paintControls()}));controls.append(row);return;
    }
    if(s===8){
      if(state.vote!==null){controls.append(make("strong","","내가 낸 표 · "+names[state.vote]),button("접수 확인","action",()=>enter(9)));return}
      controls.append(make("strong","","투표할 사람 · 후보 "+(state.count-2)+"명"),picker());
      const b=button(state.pick===null?"후보를 선택하세요":names[state.pick]+"에게 투표 확정","action",()=>{
        state.vote=state.pick;enter(9)});b.disabled=state.pick===null;controls.append(b);return;
    }
    controls.append(make("strong","","지호의 표　→　"+names[state.vote]),make("p","muted","표를 확정했어요. 다른 사람에게 내 표는 보이지 않아요."));
  }
  function render(){
    chapter.value=String(state.scene);
    folded.hidden=state.scene===4;
    const s=state.scene;
    byId("title").textContent=scenes[s][1];byId("rule").textContent=scenes[s][2];byId("phase").textContent=phaseLabel();
    root.querySelector(".handset").classList.toggle("home",s===0);
    root.querySelector(".handset").classList.toggle("voting",s===8||s===9);
    paintWorld(world,s===2?false:seated(),false);
    const showSeats=isFree()||s===2||s===0;
    paintWorld(preview,showSeats,true);
    byId("compare-label").textContent=showSeats?"같은 "+state.count+"명의 집결 좌석":"같은 재즈 바 · 자유 이동 배치";
    byId("point").textContent=notes[s][0];
    byId("detail").textContent=s===8?state.count+"명으로 시작해 "+(state.count-1)+"명이 살아 있습니다. 도윤의 자리는 비워 두고, 자신을 제외한 "+(state.count-2)+"명이 후보판에 나옵니다.":notes[s][1];
    byId("prev").disabled=s===0;
    byId("next").disabled=s===8&&state.vote===null;
    byId("next").textContent=s===9?"다시 투표해 보기":s===1||s===6?"자동 집결 보기":"다음 장면";
    chapter.options[9].disabled=state.vote===null;
    paintControls();
  }
  chapter.addEventListener("change",()=>enter(Number(chapter.value)));
  byId("prev").onclick=()=>enter(state.scene===2?(state.targetScene===7?6:1):state.scene-1);
  byId("next").onclick=()=>{if(state.scene===9){state.vote=null;enter(8)}else advance()};
  byId("count").onchange=ev=>{
    state.count=Number(ev.target.value);state.mark=null;state.vote=null;state.request=false;state.remark=false;state.messages={};state.drafts={};resetPositions();
    enter(state.scene===9?8:state.scene);
  };
  resetPositions();render();
})();
