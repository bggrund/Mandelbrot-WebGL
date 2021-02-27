var $_GET = [];
var program;
var canvas;
var vertices = [];
var colors = [];
var colorsLoc, numColorsLoc;
var origVerticesLength = 0;
var zoom = 2, zoomInc = 1.5, zoomLoc;
var offx = -1.0, offy = 0.0;//, offxLoc, offyLoc;
var lastx, lasty;
var kVal = vec2(-1, 0.25), kValLoc;
var theta = 0;
var maxIter = 1000, iterLoc;
var mandel = true, mandelLoc;
var tempMandel = true;
var restype = 1;
var permlowres = false;
var rotPointA, rotPointB, rotRadius, rotIncrmt, rotTheta, rotThetaEl;
var ms = 10;
var dragmode = 1; //1=pan, 2=select julia animation circle
var mScale, mTrans, mScaleLoc, mTransLoc;
var selectionCenter = vec2(0.0,0.0);
var selectionVertices = [];
var nonTransLoc;
var animating = false;
var thetaNode;
var intervalID;
var colorOffsetLoc, colorOffset = 0.0;
var colorIncrmt;
var aspect, aspectLoc;
var rightDiv, bottomDiv;
var colorDensityLoc, colorDensity;
var resizing = 0; //0=none, 1=right, 2=bottom
/*todo
mandelbrot options
*/

window.onload = function init() {
    canvas = document.getElementById("gl-canvas");
    gl = WebGLUtils.setupWebGL(canvas);
    if (!gl) { alert("WebGL isn't available"); }

    gl.clearColor(0.0, 0.0, 0.0, 1.0);

    //gpu variables
    program = initShaders(gl, "vertex-shader", "fragment-shader");
    gl.useProgram(program);
    zoomLoc = gl.getUniformLocation(program, "zoom");
    //offxLoc = gl.getUniformLocation(program, "offx");
    //offyLoc = gl.getUniformLocation(program, "offy");
    kValLoc = gl.getUniformLocation(program, "kVal");
    iterLoc = gl.getUniformLocation(program, "maxIter");
    mandelLoc = gl.getUniformLocation(program, "mandel");
    mScaleLoc = gl.getUniformLocation(program, "mScale");
    mTransLoc = gl.getUniformLocation(program, "mTrans");
    nonTransLoc = gl.getUniformLocation(program, "nonTransform");
    colorOffsetLoc = gl.getUniformLocation(program, "colorOffset");
    aspectLoc = gl.getUniformLocation(program, "aspect");
    colorsLoc = gl.getUniformLocation(program, "colors");
    numColorsLoc = gl.getUniformLocation(program, "numColors");
    colorDensityLoc = gl.getUniformLocation(program, "colorDensity");

    //mouse events
    canvas.addEventListener("mousedown", canvasmousedown);
    canvas.addEventListener("mouseup", canvasmouseup);
    canvas.addEventListener("mousemove", canvasmousemove);
    canvas.addEventListener("mousewheel", canvasmousewheel, { passive: true });
    rightDiv = document.getElementById("right");
    bottomDiv = document.getElementById("bottom");
    rightDiv.addEventListener("mousemove", rightDrag);
    bottomDiv.addEventListener("mousemove", bottomDrag);
    rightDiv.addEventListener("mousedown", rightDown);
    bottomDiv.addEventListener("mousedown", bottomDown);
    rightDiv.addEventListener("mouseup", function() { setCanvasSize(); resizing = 0; });
    bottomDiv.addEventListener("mouseup", function() { setCanvasSize(); resizing = 0; });
    window.addEventListener("mousemove", windowmousemove);

    //element events
    document.getElementById("julia").addEventListener("change", function() { mandel = false; render(); });
    document.getElementById("mandel").addEventListener("change", function() { mandel = true; render(); });
    var cb1 = document.getElementById("alwayslowres");
    var rt1 = document.getElementById("lowres1");
    var rt2 = document.getElementById("lowres2");
    var rt3 = document.getElementById("lowres3");
    cb1.addEventListener("change", function() { restype = rt1.checked ? 1 : rt2.checked ? 2 : rt3.checked ? 3 : 0; permlowres = cb1.checked; rerender(permlowres ? restype : 0); });
    rt1.addEventListener("change", function() { restype = rt1.checked ? 1 : rt2.checked ? 2 : rt3.checked ? 3 : 0; if (permlowres) rerender(restype); });
    rt2.addEventListener("change", function() { restype = rt1.checked ? 1 : rt2.checked ? 2 : rt3.checked ? 3 : 0; if (permlowres) rerender(restype); });
    rt3.addEventListener("change", function() { restype = rt1.checked ? 1 : rt2.checked ? 2 : rt3.checked ? 3 : 0; if (permlowres) rerender(restype); });
    document.getElementById("animate").addEventListener("click", animBtnClick);
    document.getElementById("selectRot").addEventListener("click", function() { selectRot(true); });

    rotThetaEl = document.getElementById("rotTheta");

    var params = location.search.slice(1).split('&');
    if (params.length <= 1) {
        for (var i = 1; i <= 6; i++) {
            document.getElementById("cb" + i).checked = true;
        }
    }
    for (var i = 0, len = params.length; i < len; i++) {
        var keyVal = params[i].split('=');
        if (keyVal[0] == "") break;
        keyVal[1] = keyVal[1].replace("%23", "#");
        $_GET[decodeURIComponent(keyVal[0])] = decodeURIComponent(keyVal[1]);
        if (keyVal[0] == "set" || keyVal[0] == "lowres") {
            document.getElementById(keyVal[1]).checked = true;
        }
        else {
            if (keyVal[1] == "on")
                document.getElementById(keyVal[0]).checked = true;
            else {
                document.getElementById(keyVal[0]).value = keyVal[1];
            }
        }
    }

    restype = rt1.checked ? 1 : rt2.checked ? 2 : rt3.checked ? 3 : 0;
    permlowres = cb1.checked;

    rightDiv.style.width = parseInt(document.getElementById("rightWidth").value, 10) + "px";
    bottomDiv.style.height = parseInt(document.getElementById("bottomHeight").value, 10) + "px";

    mandel = document.getElementById("mandel").checked;

    window.onresize = setCanvasSize;

    updateData(true);

    setCanvasSize();

    //animate();
};

function submitForm() {
    document.getElementById("rightWidth").value = rightDiv.offsetWidth;
    document.getElementById("bottomHeight").value = bottomDiv.offsetHeight;
}

function selectRot(start) {
    document.getElementById("juliaSettings").disabled = start;
    if (start) {
        tempMandel = mandel;
        mandel = true;
        render();

        dragmode = 2;
    }
    else {
        dragmode = 1;
        mandel = tempMandel;
        selectionVertices = [];

        var centerP = matrixVecMult(mScale, matrixVecMult(mTrans, vec4(selectionCenter[0], selectionCenter[1], 0, 1)));
        var circleP = matrixVecMult(mScale, matrixVecMult(mTrans, vec4(lastx, lasty, 0, 1)));
        var radius = Math.sqrt(Math.pow(circleP[0] - centerP[0], 2) + Math.pow(circleP[1] - centerP[1], 2));

        document.getElementById("rotPointA").value = centerP[0];
        document.getElementById("rotPointB").value = centerP[1];
        document.getElementById("rotRadius").value = radius;

        updateData(false);
        
        rerender(permlowres ? restype : 0);
    }
}

function animBtnClick() {
    if (document.getElementById("animate").value == "Animate") {
        theta = parseFloat(rotThetaEl.value);
        intervalID = window.setInterval(function() { window.requestAnimationFrame(animate); }, ms);
        animating = true;
        document.getElementById("animate").value = "Stop";
    }
    else if (document.getElementById("animate").value == "Stop") {
        window.clearInterval(intervalID);
        animating = false;
        document.getElementById("animate").value = "Animate";
    }
}

function animate() {
    if (mandel) {
        colorOffset += colorIncrmt;
        render();
    }
    else {
        theta += rotIncrmt;
        colorOffset += colorIncrmt;
        kVal = vec2(rotRadius * Math.cos(radians(theta)) + rotPointA, rotRadius * Math.sin(radians(theta)) + rotPointB);
        render();
        rotThetaEl.value = (theta % 360).toFixed(1);
    }
}

//dynamically resize canvas based on window size
function setCanvasSize() {
    var divH = parseInt(document.getElementById("bottom").offsetHeight);
    var divW = document.getElementById("right").offsetWidth;
    canvas.height = window.innerHeight - divH;
    //if (canvas.height % 2 == 1) canvas.height += 1;
    canvas.width = window.innerWidth - document.getElementById("options").offsetWidth - divW - 5;
    /*if (canvas.width > window.innerWidth - document.getElementById("options").offsetWidth - 17) {
        canvas.width = window.innerWidth - document.getElementById("options").offsetWidth - 17;
        canvas.height = canvas.width;
    }*/

    aspect = canvas.width / canvas.height;

    /*var b = window.innerHeight - canvas.height;
    if (b < 0) b = 0;

    document.getElementById("overlayBL").style.bottom = "" + b + "px";*/
    
    rerender(permlowres ? restype : 0);
}

function rightDown(e) {
    if (e.buttons == 1) {
        lastx = e.offsetX;
        lasty = e.offsetY;
        resizing = 1;
    }
}
function rightDrag(e) {
    if (e.buttons == 1) {
        if (resizing == 1) {
            //var w = parseInt(rightDiv.offsetWidth);
            rightDiv.style.width = "" + (window.innerWidth - e.clientX).toFixed(0) + "px";
        }
        else if (resizing == 2) {
            //var h = parseInt(bottomDiv.offsetHeight);
            bottomDiv.style.height = "" + (window.innerHeight - e.clientY).toFixed(0) + "px";
        }
        else if (resizing == 0) {
            if (e.buttons == 1) {
                var currx = -1 + 2 * (e.offsetX + canvas.width) / canvas.width;
                var curry = -1 + 2 * (canvas.height - e.offsetY) / canvas.height;

                offx -= (currx - lastx) * zoom;
                offy -= (curry - lasty) * zoom;

                lastx = currx;
                lasty = curry;

                render();
            }
        }
    }
}
function bottomDown(e) {
    if (e.buttons == 1) {
        lastx = e.offsetX;
        lasty = e.offsetY;
        resizing = 2;
    }
}
function bottomDrag(e) {
    if (e.buttons == 1) {
        if (resizing == 2) {
            //var h = parseInt(bottomDiv.offsetHeight);
            bottomDiv.style.height = "" + (window.innerHeight - e.clientY).toFixed(0) + "px";
        }
        else if (resizing == 1) {
            //var w = parseInt(rightDiv.offsetWidth);
            rightDiv.style.width = "" + (window.innerWidth - e.clientX).toFixed(0) + "px";
        }
        else if (resizing == 0) {
            if (e.buttons == 1) {
                var currx = -1 + 2 * e.offsetX / canvas.width;
                var curry = -1 + 2 * (-e.offsetY) / canvas.height;

                offx -= (currx - lastx) * zoom;
                offy -= (curry - lasty) * zoom;

                lastx = currx;
                lasty = curry;

                render();
            }
        }
    }
}

function windowmousemove(e){
    if (e.buttons == 1) {
        if (resizing == 1) {
            //var w = parseInt(rightDiv.offsetWidth);
            rightDiv.style.width = "" + (window.innerWidth - e.clientX).toFixed(0) + "px";
        }
        else if (resizing == 2) {
            //var h = parseInt(bottomDiv.offsetHeight);
            bottomDiv.style.height = "" + (window.innerHeight - e.clientY).toFixed(0) + "px";
        }
    }
}

function canvasmousedown(e) {
    if (dragmode == 1) {
        if (e.buttons == 1) {
            lastx = -1 + 2 * e.offsetX / canvas.width;
            lasty = -1 + 2 * (canvas.height - e.offsetY) / canvas.height;

            if (!permlowres) rerender(restype);
        }
    }
    else if (dragmode == 2) {
        if (e.buttons == 1) {
            lastx = -1 + 2 * e.offsetX / canvas.width;
            lasty = -1 + 2 * (canvas.height - e.offsetY) / canvas.height;

            selectionCenter = vec2(lastx, lasty);
        }
        else if (e.buttons == 2) {
            lastx = -1 + 2 * e.offsetX / canvas.width;
            lasty = -1 + 2 * (canvas.height - e.offsetY) / canvas.height;

            if (!permlowres) rerender(restype);
        }
    }
}

function canvasmousemove(e) {
    if (resizing == 1) {
        //var w = parseInt(rightDiv.offsetWidth);
        rightDiv.style.width = "" + (window.innerWidth - e.clientX).toFixed(0) + "px";

        return;
    }
    if (resizing == 2) {
        //var h = parseInt(bottomDiv.offsetHeight);
        bottomDiv.style.height = "" + (window.innerHeight - e.clientY).toFixed(0) + "px";

        return;
    }
    if (dragmode == 1) {
        if (e.buttons == 1) {
            var currx = -1 + 2 * e.offsetX / canvas.width;
            var curry = -1 + 2 * (canvas.height - e.offsetY) / canvas.height;

            offx -= (currx - lastx) * zoom;
            offy -= (curry - lasty) * zoom;

            document.getElementById("centerPointA").value = offx;
            document.getElementById("centerPointB").value = offy;

            lastx = currx;
            lasty = curry;

            render();
        }
    }
    /*else if (e.buttons == 2) {
        var currx = -1 + 2 * e.offsetX / canvas.width;
        var curry = -1 + 2 * (canvas.height - e.offsetY) / canvas.height;

        kVal = vec2(currx / zoom * 2, curry / zoom * 2);

        render();
    }*/
    else if (dragmode == 2) {
        if (e.buttons == 1) {
            var currx = -1 + 2 * e.offsetX / canvas.width;
            var curry = -1 + 2 * (canvas.height - e.offsetY) / canvas.height;
            
            selectionVertices = [];
            var radius = Math.sqrt(Math.pow(currx - selectionCenter[0], 2) + Math.pow((curry - selectionCenter[1]) / aspect, 2));
            for (var theta = 0.0; theta <= 360.0; theta += 3.0) {
                selectionVertices.push(vec2(selectionCenter[0] + radius * Math.cos(theta * Math.PI / 180.0), selectionCenter[1] + radius * Math.sin(theta * Math.PI / 180.0) * aspect));
            }

            render();
        }
        else if (e.buttons == 2) {
                var currx = -1 + 2 * e.offsetX / canvas.width;
                var curry = -1 + 2 * (canvas.height - e.offsetY) / canvas.height;

                offx -= (currx - lastx) * zoom;
                offy -= (curry - lasty) * zoom;

                document.getElementById("centerPointA").value = offx;
                document.getElementById("centerPointB").value = offy;

                lastx = currx;
                lasty = curry;

                render();
        }
    }
}

function canvasmouseup(e) {
    if (resizing) {
        setCanvasSize();
        return;
    }
    if (dragmode == 2) {
        if (e.button == 0) {
            lastx = -1 + 2 * e.offsetX / canvas.width;
            lasty = -1 + 2 * (canvas.height - e.offsetY) / canvas.height;
            selectRot(false);
        }
        else if (e.buttons == 2) {
            lastx = -1 + 2 * e.offsetX / canvas.width;
            lasty = -1 + 2 * (canvas.height - e.offsetY) / canvas.height;
        }
    }
    if (!permlowres) rerender(0);
}

function canvasmousewheel(e) {
    if (e.deltaY > 0) {
        zoom *= zoomInc;
        document.getElementById("zoomAmt").value = zoom;
    }
    else if (e.deltaY < 0) {
        zoom /= zoomInc;
        document.getElementById("zoomAmt").value = zoom;
    }
    
    render();
}

function updateData(norend) {
    rotPointA = parseFloat(document.getElementById("rotPointA").value);
    rotPointB = parseFloat(document.getElementById("rotPointB").value);
    rotRadius = parseFloat(document.getElementById("rotRadius").value);
    rotIncrmt = parseFloat(document.getElementById("rotIncrmt").value);
    theta = rotTheta = parseFloat(document.getElementById("rotTheta").value);
    kVal = vec2(rotRadius * Math.cos(radians(theta)) + rotPointA, rotRadius * Math.sin(radians(theta)) + rotPointB);
    ms = 694 / parseFloat(document.getElementById("framerate").value);
    maxIter = parseInt(document.getElementById("maxiter").value, 10);
    colorIncrmt = parseFloat(document.getElementById("colorIncrmt").value) / 3000.0;
    colorDensity = parseFloat(document.getElementById("colorDensity").value) / 5.0 //Math.pow(parseFloat(document.getElementById("colorDensity").value), 1.2) + 50;
    zoom = parseFloat(document.getElementById("zoomAmt").value);
    offx = parseFloat(document.getElementById("centerPointA").value);
    offy = parseFloat(document.getElementById("centerPointB").value);

    colors = [];
    for (var i = 1; i <= 12; i++) {
        var cb = document.getElementById("cb" + i);
        if (cb.checked) {
            var c = document.getElementById("c" + i);
            var rgb = (hexToRgb((c.value).split('#')[1])).split(',');
            colors.push(vec3(parseFloat(rgb[0]) / 255.0, parseFloat(rgb[1]) / 255.0, parseFloat(rgb[2]) / 255.0));
        }
    }
    if(document.getElementById("wrapcolors").checked) {
        var initLen = colors.length;
        for(var i = initLen - 1; i >= 0; i--){
            colors.push(colors[i]);
        }
    }

    if (norend) return;

    if (animating) {
        window.clearInterval(intervalID);
        intervalID = window.setInterval(function() { window.requestAnimationFrame(animate); }, ms);
    }
    else {
        render();
    }
}

function render() {

    gl.clear(gl.COLOR_BUFFER_BIT);
    
    if (mandel)
        gl.uniform1i(mandelLoc, 1);
    else
        gl.uniform1i(mandelLoc, 0);

    gl.uniform1i(nonTransLoc, 0);        
    gl.uniform1f(zoomLoc, zoom);
    mTrans = translate(offx / zoom, offy / zoom, 0.0);
    gl.uniformMatrix4fv(mTransLoc, false, flatten(mTrans));
    mScale = scale(aspect * zoom, zoom, 1.0);
    gl.uniformMatrix4fv(mScaleLoc, false, flatten(mScale));
    gl.uniform2fv(kValLoc, kVal);
    gl.uniform1i(iterLoc, maxIter);
    gl.uniform1f(colorOffsetLoc, colorOffset);
    gl.uniform1f(aspectLoc, aspect);
    gl.uniform3fv(colorsLoc, flatten(colors));
    gl.uniform1i(numColorsLoc, colors.length);
    gl.uniform1f(colorDensityLoc, colorDensity);
    
    if (triangles)
        gl.drawArrays(gl.TRIANGLES, 0, origVerticesLength);
    else
        gl.drawArrays(gl.LINES, 0, origVerticesLength);

    if (selectionVertices.length > 0) {
        gl.bufferSubData(gl.ARRAY_BUFFER, origVerticesLength * 8, flatten(selectionVertices));
        gl.uniform1i(nonTransLoc, 1);
        gl.drawArrays(gl.LINE_STRIP, origVerticesLength, selectionVertices.length);
    }
}

function rerender(restype) {

    gl.viewport(0, 0, canvas.width, canvas.height);

    vertices = [];

    triangles = true;
    
    vertices.push(vec2(-1.0, 1.0));
    vertices.push(vec2(1.0, 1.0));
    vertices.push(vec2(1.0, -1.0));
    vertices.push(vec2(-1.0, 1.0));
    vertices.push(vec2(1.0, -1.0));
    vertices.push(vec2(-1.0, -1.0));

    origVerticesLength = vertices.length;

    for (var theta = 0.0; theta <= 360.0; theta += 3.0) {
        vertices.push(vec2(0.0, 0.0));
    }

    var bufferId = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, bufferId);
    gl.bufferData(gl.ARRAY_BUFFER, flatten(vertices), gl.STATIC_DRAW);

    var vPosition = gl.getAttribLocation(program, "vPosition");
    gl.vertexAttribPointer(vPosition, 2, gl.FLOAT, false, 0, 0);
    gl.enableVertexAttribArray(vPosition);

    /*var colorBuffer = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, colorBuffer);
    gl.bufferData(gl.ARRAY_BUFFER, flatten(colors), gl.STATIC_DRAW);

    var vColor = gl.getAttribLocation(program, "vColor");
    gl.vertexAttribPointer(vColor, 4, gl.FLOAT, false, 0, 0);
    gl.enableVertexAttribArray(vColor);*/

    render();
}

function matrixVecMult(mat, vec) {
    var result = [];
    var sum = 0;
    for (var i = 0; i < mat.length; i++) {
        sum = 0;
        for (var j = 0; j < mat[i].length; j++) {
            sum += mat[i][j] * vec[j];
        }
        result.push(sum);
    }

    return result;
}

function hexToRgb(hex) {
    var bigint = parseInt(hex, 16);
    var r = (bigint >> 16) & 255;
    var g = (bigint >> 8) & 255;
    var b = bigint & 255;

    return r + "," + g + "," + b;
}