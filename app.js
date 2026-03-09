const deviceSelect=document.getElementById("deviceSelect");
const resolutionSelect=document.getElementById("resolutionSelect");
const displayMode=document.getElementById("displayMode");
const zoomSlider=document.getElementById("zoomSlider");

const startBtn=document.getElementById("startBtn");
const resetBtn=document.getElementById("resetViewBtn");
const fullscreenBtn=document.getElementById("fullscreenBtn");
const screenshotBtn=document.getElementById("screenshotBtn");

const viewer=document.getElementById("viewer");
const video=document.getElementById("video");
const canvas=document.getElementById("captureCanvas");

let stream=null;

let scale=1;
let offsetX=0;
let offsetY=0;

let dragging=false;
let startX=0;
let startY=0;

let pinchStartDist=null;
let pinchStartScale=1;

async function listDevices(){

const devices=await navigator.mediaDevices.enumerateDevices();
const cams=devices.filter(d=>d.kind==="videoinput");

deviceSelect.innerHTML="";

cams.forEach(d=>{
const o=document.createElement("option");
o.value=d.deviceId;
o.text=d.label||"Camera";
deviceSelect.appendChild(o);
});

}

async function startStream(){

if(stream)stream.getTracks().forEach(t=>t.stop());

const [w,h]=resolutionSelect.value.split("x").map(Number);

const constraints={
video:{
deviceId:{exact:deviceSelect.value},
width:{ideal:w},
height:{ideal:h}
}
};

stream=await navigator.mediaDevices.getUserMedia(constraints);

video.srcObject=stream;

video.onloadedmetadata=()=>{
video.play();
applyDisplayMode();
};

}

function applyDisplayMode(){

const vW=video.videoWidth;
const vH=video.videoHeight;

if(!vW)return;

const viewW=viewer.clientWidth;
const viewH=viewer.clientHeight;

let targetW=vW;
let targetH=vH;

const cover=Math.max(viewW/vW,viewH/vH);
const contain=Math.min(viewW/vW,viewH/vH);

switch(displayMode.value){

case "fit":
targetW=vW*contain;
targetH=vH*contain;
break;

case "fill":
targetW=vW*cover;
targetH=vH*cover;
break;

case "stretch":
targetW=viewW;
targetH=viewH;
break;

case "original":
targetW=vW;
targetH=vH;
break;

default:
targetW=vW*contain;
targetH=vH*contain;

}

targetW*=scale;
targetH*=scale;

video.style.width=targetW+"px";
video.style.height=targetH+"px";

video.style.left=(viewW-targetW)/2+offsetX+"px";
video.style.top=(viewH-targetH)/2+offsetY+"px";

}

zoomSlider.addEventListener("input",()=>{

scale=parseFloat(zoomSlider.value);
applyDisplayMode();

});

resetBtn.onclick=()=>{

scale=1;
offsetX=0;
offsetY=0;

zoomSlider.value=1;

applyDisplayMode();

};

fullscreenBtn.onclick=()=>viewer.requestFullscreen();

screenshotBtn.onclick=()=>{

canvas.width=video.videoWidth;
canvas.height=video.videoHeight;

const ctx=canvas.getContext("2d");

ctx.drawImage(video,0,0);

canvas.toBlob(blob=>{

const url=URL.createObjectURL(blob);

const a=document.createElement("a");
a.href=url;
a.download="capture.png";
a.click();

});

};

viewer.addEventListener("mousedown",e=>{

dragging=true;
startX=e.clientX;
startY=e.clientY;

});

window.addEventListener("mouseup",()=>dragging=false);

window.addEventListener("mousemove",e=>{

if(!dragging)return;

offsetX+=e.clientX-startX;
offsetY+=e.clientY-startY;

startX=e.clientX;
startY=e.clientY;

applyDisplayMode();

});

viewer.addEventListener("touchstart",e=>{

if(e.touches.length===1){

dragging=true;
startX=e.touches[0].clientX;
startY=e.touches[0].clientY;

}

if(e.touches.length===2){

const dx=e.touches[0].clientX-e.touches[1].clientX;
const dy=e.touches[0].clientY-e.touches[1].clientY;

pinchStartDist=Math.sqrt(dx*dx+dy*dy);
pinchStartScale=scale;

}

},{passive:false});

viewer.addEventListener("touchmove",e=>{

if(e.touches.length===1&&dragging){

const x=e.touches[0].clientX;
const y=e.touches[0].clientY;

offsetX+=x-startX;
offsetY+=y-startY;

startX=x;
startY=y;

applyDisplayMode();

}

if(e.touches.length===2){

const dx=e.touches[0].clientX-e.touches[1].clientX;
const dy=e.touches[0].clientY-e.touches[1].clientY;

const dist=Math.sqrt(dx*dx+dy*dy);

scale=pinchStartScale*(dist/pinchStartDist);

scale=Math.min(Math.max(scale,0.5),2);

zoomSlider.value=scale;

applyDisplayMode();

}

},{passive:false});

window.addEventListener("resize",applyDisplayMode);

startBtn.onclick=startStream;

navigator.mediaDevices.addEventListener("devicechange",listDevices);

listDevices();