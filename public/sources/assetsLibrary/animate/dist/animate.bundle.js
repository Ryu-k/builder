(function(e){var t={};function a(n){if(t[n]){return t[n].exports}var r=t[n]={i:n,l:false,exports:{}};e[n].call(r.exports,r,r.exports,a);r.l=true;return r.exports}a.m=e;a.c=t;a.d=function(e,t,n){if(!a.o(e,t)){Object.defineProperty(e,t,{configurable:false,enumerable:true,get:n})}};a.r=function(e){Object.defineProperty(e,"__esModule",{value:true})};a.n=function(e){var t=e&&e.__esModule?function t(){return e["default"]}:function t(){return e};a.d(t,"a",t);return t};a.o=function(e,t){return Object.prototype.hasOwnProperty.call(e,t)};a.p=".";return a(a.s=0)})({"./src/animate.css":function(e,t){},"./src/animate.js":function(e,t,a){"use strict";window.vcv.on("ready",function(e,t,a){var n=function e(t,a,n){var i=t?'[data-vcv-element="'+t+'"]':"[data-vce-animate]";var c=document.querySelectorAll(i);c=[].slice.call(c);c.forEach(function(e){if(t){if(!n){var i=e;if(!i.getAttribute("data-vce-animate")){i=e.querySelector("[data-vce-animate]:not([data-vcv-animate-fieldkey])")}if(i){r(i)}if(a==="add"){var c=e.querySelectorAll("[data-vcv-animate-fieldkey]");c=[].slice.call(c);c.forEach(function(e){r(e)})}}else{var o='[data-vce-animate][data-vcv-animate-fieldkey="'+n+'"]';var u=e.querySelector(o);if(u){r(u)}}}else{r(e)}})};var r=function e(t){var a=t.vcvWaypoints;if(a){a.destroy();t.removeAttribute("data-vcv-o-animated")}var n=new window.Waypoint({element:t,handler:function e(a,r,i,c,o){t.setAttribute("data-vcv-o-animated","true");n.destroy()},offset:"85%"});t.vcvWaypoints=n};if(e==="add"||e===undefined||e==="update"&&a&&(a.changedAttribute==="animation"||a.changedAttributeType==="animateDropdown"||!a.hidden)){var i="";if(e&&a&&a.changedAttributeType==="animateDropdown"&&a.changedAttribute!=="animation"){i=a.changedAttribute}n(e&&t?t:"",e,i)}})},0:function(e,t,a){a("./src/animate.js");e.exports=a("./src/animate.css")}});