const video = document.getElementById("video")
const deviceSelect = document.getElementById("deviceSelect")
const resolutionSelect = document.getElementById("resolutionSelect")
const fpsSelect = document.getElementById("fpsSelect")
const aspectSelect = document.getElementById("aspectSelect")

const startBtn = document.getElementById("startBtn")
const mirrorBtn = document.getElementById("mirrorBtn")
const screenshotBtn = document.getElementById("screenshotBtn")
const fullscreenBtn = document.getElementById("fullscreenBtn")
const exitFullscreen = document.getElementById("exitFullscreen")
const pipBtn = document.getElementById("pipBtn")
const zoomReset = document.getElementById("zoomReset")

const canvas = document.getElementById("captureCanvas")

let stream
let mirror=false
let zoom=1
let panX=0
let panY=0

async function listDevices(){

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

const [w,h] = resolutionSelect.value.split("x")

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

}

startBtn.onclick=startStream

aspectSelect.onchange=()=>{
video.style.objectFit=aspectSelect.value
}

mirrorBtn.onclick=()=>{
mirror=!mirror
video.style.transform=mirror ? "scaleX(-1)" : "scaleX(1)"
}

fullscreenBtn.onclick=()=>{
document.getElementById("viewer").requestFullscreen()
}

exitFullscreen.onclick=()=>{
document.exitFullscreen()
}

pipBtn.onclick=()=>{
video.requestPictureInPicture()
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

zoomReset.onclick=()=>{
zoom=1
panX=0
panY=0
updateTransform()
}

function updateTransform(){

video.style.transform=
`scale(${zoom}) translate(${panX}px,${panY}px)`

}

video.addEventListener("wheel",e=>{

zoom+=e.deltaY*-0.001
zoom=Math.min(Math.max(.5,zoom),5)

updateTransform()

})

let fps=0
let last=performance.now()

function fpsLoop(){

fps++

const now=performance.now()

if(now-last>1000){

document.getElementById("fpsCounter").innerText=`FPS ${fps}`

fps=0
last=now

}

requestAnimationFrame(fpsLoop)

}

fpsLoop()

navigator.mediaDevices.addEventListener("devicechange",listDevices)

listDevices()