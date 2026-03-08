const video = document.getElementById("video")
const viewer = document.getElementById("viewer")

const deviceSelect = document.getElementById("deviceSelect")
const resolutionSelect = document.getElementById("resolutionSelect")
const fpsSelect = document.getElementById("fpsSelect")

const startBtn = document.getElementById("startBtn")
const fullscreenBtn = document.getElementById("fullscreenBtn")
const mirrorBtn = document.getElementById("mirrorBtn")
const screenshotBtn = document.getElementById("screenshotBtn")
const exitFullscreen = document.getElementById("exitFullscreen")

const canvas = document.getElementById("captureCanvas")

let stream
let mirror=false

async function listDevices(){

try{
await navigator.mediaDevices.getUserMedia({video:true})
}catch(e){}

const devices = await navigator.mediaDevices.enumerateDevices()

deviceSelect.innerHTML=""

devices
.filter(d=>d.kind==="videoinput")
.forEach(d=>{

const opt=document.createElement("option")
opt.value=d.deviceId
opt.text=d.label || "Video Device"

deviceSelect.appendChild(opt)

})

}

async function startStream(){

if(stream){
stream.getTracks().forEach(t=>t.stop())
}

const [w,h]=resolutionSelect.value.split("x")

const constraints={
video:{
deviceId:{exact:deviceSelect.value},
width:{ideal:Number(w)},
height:{ideal:Number(h)},
frameRate:{ideal:Number(fpsSelect.value)}
}
}

stream=await navigator.mediaDevices.getUserMedia(constraints)

video.srcObject=stream

video.onloadedmetadata=()=>{
autoFill()
}

}

function autoFill(){

const vW = video.videoWidth
const vH = video.videoHeight

const screenW = viewer.clientWidth
const screenH = viewer.clientHeight

const scale = Math.max(screenW/vW , screenH/vH)

const finalW = vW * scale
const finalH = vH * scale

video.style.width = finalW + "px"
video.style.height = finalH + "px"

video.style.left = (screenW - finalW)/2 + "px"
video.style.top = (screenH - finalH)/2 + "px"

}

window.addEventListener("resize",autoFill)

mirrorBtn.onclick=()=>{
mirror=!mirror
video.style.transform=mirror ? "scaleX(-1)" : "scaleX(1)"
}

fullscreenBtn.onclick=()=>{
viewer.requestFullscreen()
}

exitFullscreen.onclick=()=>{
document.exitFullscreen()
}

screenshotBtn.onclick=()=>{

canvas.width=video.videoWidth
canvas.height=video.videoHeight

const ctx=canvas.getContext("2d")
ctx.drawImage(video,0,0)

const link=document.createElement("a")
link.download="capture.png"
link.href=canvas.toDataURL()
link.click()

}

startBtn.onclick=startStream

navigator.mediaDevices.addEventListener("devicechange",listDevices)

listDevices()