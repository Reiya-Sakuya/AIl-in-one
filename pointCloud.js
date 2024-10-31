let points, modelLines, nearestLines; // 分别存储点、模型内部连线和最近点连线
let renderer, scene, camera;
let rotationSpeed = { x: 0.001, y: 0.001, z: 0.001 }; // 从0.003降低到0.001
const CLOUD_RADIUS = 6.0; // 增大点云半径
let pointQuaternions = []; // 存储每个点的四元数
let pointVelocities = []; // 存储每个点的角速度
let pointConnectionCounts = []; // 添加新的全局变量来存储每个点的连接数量
let previousConnections = []; // 添加新的全局变量来存储上一次的连接信息
let floatingOffset = 0; // 添加浮动偏移量变量

// 添加一个生成正态分布随机数的函数
function normalRandom(mean, stdDev) {
    let u = 0, v = 0;
    while(u === 0) u = Math.random(); // 转换u使其不为0
    while(v === 0) v = Math.random(); // 转换v使其不为0
    const num = Math.sqrt(-2.0 * Math.log(u)) * Math.cos(2.0 * Math.PI * v);
    return num * stdDev + mean;
}

// 添加一个生成连接数量的函数
function generateConnectionCount() {
    // 使用均值3.5，标准差1.5的正态分布
    const num = Math.round(normalRandom(3.5, 1.5));
    // 限制在0-7的范围内
    return Math.max(0, Math.min(7, num));
}

function initializePointCloud() {
    // 使用Three.js初始化WebGL场景
    scene = new THREE.Scene();
    camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 1000);
    renderer = new THREE.WebGLRenderer({ antialias: true });
    
    // 获取容器尺寸并设置渲染器
    const container = document.getElementById('pointCloud');
    const containerWidth = container.clientWidth;
    const containerHeight = container.clientHeight;
    renderer.setSize(containerWidth, containerHeight);
    container.appendChild(renderer.domElement);

    // 调整相机位置
    camera.position.z = 15;
    camera.position.y = 0;
    camera.aspect = containerWidth / containerHeight;
    camera.updateProjectionMatrix();

    // 模型列表（假设每个模型对应一个文件）
    const models = ['chat-glm', 'model2', 'model3', 'model4', 'model5', 'model6', 'model7', 'model8', 'model9', 'model10'];

    // 创建点云
    const geometry = new THREE.BufferGeometry();
    let totalPoints = 0;
    const modelPoints = models.map(() => {
        const points = Math.floor(Math.random() * 4) + 1; // 每个模型1到4个点
        totalPoints += points;
        return points;
    });

    const vertices = new Float32Array(totalPoints * 3); // 总点数
    let index = 0;
    const lineIndices = []; // 用于存储线条的索引

    modelPoints.forEach((points) => {
        const modelStartIndex = index;
        // 为每个模型生成随机角度
        const modelPoints = [];
        for (let i = 0; i < points; i++) {
            // 使用四元数生成随机方向
            const quaternion = new THREE.Quaternion();
            // 随机旋转轴
            const axis = new THREE.Vector3(
                Math.random() * 2 - 1,
                Math.random() * 2 - 1,
                Math.random() * 2 - 1
            ).normalize();
            // 随机旋转角度
            const angle = Math.random() * Math.PI * 2;
            quaternion.setFromAxisAngle(axis, angle);
            
            // 存储四元数
            pointQuaternions.push(quaternion);
            
            // 初始位置（北极）
            const baseVector = new THREE.Vector3(0, 0, CLOUD_RADIUS);
            // 应用四元数旋转
            baseVector.applyQuaternion(quaternion);
            
            vertices[index * 3] = baseVector.x;
            vertices[index * 3 + 1] = baseVector.y;
            vertices[index * 3 + 2] = baseVector.z;

            index++;
        }

        // 修改连线逻辑
        if (points === 2) {
            // 两点之间连一条线
            lineIndices.push(modelStartIndex, modelStartIndex + 1);
        } else if (points === 3) {
            // 三点连成三角形
            lineIndices.push(
                modelStartIndex, modelStartIndex + 1,
                modelStartIndex + 1, modelStartIndex + 2,
                modelStartIndex + 2, modelStartIndex
            );
        } else if (points >= 4) {
            // 四点及以上只需串成一条线
            for (let i = 0; i < points - 1; i++) {
                lineIndices.push(
                    modelStartIndex + i,
                    modelStartIndex + i + 1
                );
            }
        }
    });

    geometry.setAttribute('position', new THREE.BufferAttribute(vertices, 3));

    // 初始化每个点的角速度，降低游走速度
    for (let i = 0; i < totalPoints; i++) {
        pointVelocities.push(new THREE.Vector3(
            (Math.random() - 0.5) * 0.08, // 从0.15降低到0.08
            (Math.random() - 0.5) * 0.08,
            (Math.random() - 0.5) * 0.08
        ));
    }

    // 初始化每个点的连接数量
    for (let i = 0; i < totalPoints; i++) {
        pointConnectionCounts[i] = generateConnectionCount();
    }

    // 修改点材质的设置，使用自定义着色器
    const material = new THREE.ShaderMaterial({
        uniforms: {
            cameraPosition: { value: camera.position },
            baseColor: { value: new THREE.Color(0xffffff) }
        },
        vertexShader: `
            varying float vDepth;
            void main() {
                vec4 mvPosition = modelViewMatrix * vec4(position, 1.0);
                gl_Position = projectionMatrix * mvPosition;
                
                // 计算到相机的距离
                vDepth = -mvPosition.z;
                
                // 设置点的大小
                gl_PointSize = 7.0; // 从5.0增加到7.0
            }
        `,
        fragmentShader: `
            uniform vec3 baseColor;
            varying float vDepth;
            void main() {
                // 根据深度计算颜色强度，调整深度范围和对比度
                float intensity = 1.0 - smoothstep(4.0, 18.0, vDepth); // 调整深度范围
                vec3 color = baseColor * (intensity * 0.8 + 0.2); // 增加对比度
                gl_FragColor = vec4(color, 1.0);
            }
        `
    });
    points = new THREE.Points(geometry, material);
    scene.add(points);

    // 创建模型内部的线条
    const modelLineGeometry = new THREE.BufferGeometry();
    modelLineGeometry.setAttribute('position', new THREE.BufferAttribute(vertices, 3));
    modelLineGeometry.setIndex(lineIndices);
    const modelLineMaterial = new THREE.LineBasicMaterial({ 
        color: 0xcccccc,  // 浅灰色
        transparent: true,
        opacity: 0.4,     // 稍微增加不透明度
        depthWrite: false,
        depthTest: true,
        linewidth: 2      // 增加线条宽度
    });
    modelLines = new THREE.LineSegments(modelLineGeometry, modelLineMaterial);
    scene.add(modelLines);

    // 创建最近点之间的连线
    const nearestLineIndices = findNearestPointConnections(vertices);
    const nearestLineGeometry = new THREE.BufferGeometry();
    nearestLineGeometry.setAttribute('position', new THREE.BufferAttribute(vertices, 3));
    nearestLineGeometry.setIndex(nearestLineIndices);
    const nearestLineMaterial = new THREE.LineDashedMaterial({
        color: 0x999999,  // 改为中灰色
        transparent: true,
        opacity: 0.2,
        dashSize: 0.1,
        gapSize: 0.1,
        depthWrite: false,
        depthTest: true
    });
    nearestLines = new THREE.LineSegments(nearestLineGeometry, nearestLineMaterial);
    nearestLines.computeLineDistances();
    scene.add(nearestLines);

    // 在创建其他点之前，添加心的红点
    const centerGeometry = new THREE.BufferGeometry();
    const centerVertex = new Float32Array([0, 0, 0]); // 球心坐标
    centerGeometry.setAttribute('position', new THREE.BufferAttribute(centerVertex, 3));
    
    const centerMaterial = new THREE.PointsMaterial({
        color: 0xff0000,  // 红色
        size: 0.5,        // 稍大一点的尺寸
        sizeAttenuation: true
    });
    
    const centerPoint = new THREE.Points(centerGeometry, centerMaterial);
    scene.add(centerPoint);

    window.addEventListener('resize', onWindowResize, false);

    document.getElementById('userInput').addEventListener('focus', () => {
        animatePulse(true); // 焦点进入：缩小放大
    });

    document.getElementById('userInput').addEventListener('blur', () => {
        animatePulse(false); // 焦点离开：放大缩小
    });

    function animate() {
        requestAnimationFrame(animate);
        
        // 添加浮动动画，8秒一个周期（从6秒改为8秒）
        floatingOffset += Math.PI * 2 / (8 * 60); // 8秒完成一个周期（假设60fps）
        const floatingHeight = Math.sin(floatingOffset) * 1.2; // 保持浮动幅度不变
        
        // 先应用旋转
        points.rotation.x += rotationSpeed.x;
        points.rotation.y += rotationSpeed.y;
        points.rotation.z += rotationSpeed.z;
        modelLines.rotation.copy(points.rotation);
        nearestLines.rotation.copy(points.rotation);
        centerPoint.rotation.copy(points.rotation);
        
        // 设置整体Y轴偏移（不受旋转影响）
        points.position.y = floatingHeight;
        modelLines.position.y = floatingHeight;
        nearestLines.position.y = floatingHeight;
        centerPoint.position.y = floatingHeight;
        
        // 每0.5秒更新一次连接数量和连接策略
        if (Math.floor(performance.now() / 500) > Math.floor((performance.now() - 16) / 500)) {
            // 50%的概率在这次更新中忽略之前的连接
            const shouldIgnorePrevious = Math.random() < 0.5;
            
            // 计算当前所有点的位置和距离
            const currentPositions = [];
            const vertexPositions = points.geometry.attributes.position.array;
            for (let i = 0; i < vertexPositions.length; i += 3) {
                currentPositions.push({
                    index: i / 3,
                    x: vertexPositions[i],
                    y: vertexPositions[i + 1],
                    z: vertexPositions[i + 2]
                });
            }

            // 计算每个点对的距离和忽略概率
            const distanceProbs = new Map();
            for (let i = 0; i < currentPositions.length; i++) {
                for (let j = i + 1; j < currentPositions.length; j++) {
                    const dx = currentPositions[i].x - currentPositions[j].x;
                    const dy = currentPositions[i].y - currentPositions[j].y;
                    const dz = currentPositions[i].z - currentPositions[j].z;
                    const distance = Math.sqrt(dx * dx + dy * dy + dz * dz);
                    
                    let ignoreProb = 0;
                    const normalizedDist = distance / CLOUD_RADIUS;
                    if (normalizedDist > 0.7) {
                        ignoreProb = Math.min(0.85, (normalizedDist - 0.7) / 0.8 * 0.85);
                    }
                    
                    const shouldIgnore = Math.random() < ignoreProb;
                    distanceProbs.set(`${i}-${j}`, shouldIgnore);
                }
            }
            
            pointConnectionCounts = pointConnectionCounts.map((_, index) => {
                if (shouldIgnorePrevious) {
                    previousConnections[index] = findNearestPointConnections(
                        vertexPositions, 
                        index, 
                        true,
                        distanceProbs
                    );
                }
                return generateConnectionCount();
            });
        }
        
        // 更新点的位置
        const positions = points.geometry.attributes.position.array;
        for (let i = 0; i < totalPoints; i++) {
            const velocityQuaternion = new THREE.Quaternion();
            velocityQuaternion.setFromAxisAngle(pointVelocities[i], pointVelocities[i].length());
            
            pointQuaternions[i].multiply(velocityQuaternion);
            pointQuaternions[i].normalize();
            
            const baseVector = new THREE.Vector3(0, 0, CLOUD_RADIUS);
            baseVector.applyQuaternion(pointQuaternions[i]);
            
            const currentPosition = new THREE.Vector3(
                baseVector.x,
                baseVector.y,
                baseVector.z
            ).normalize().multiplyScalar(CLOUD_RADIUS);
            
            positions[i * 3] = currentPosition.x;
            positions[i * 3 + 1] = currentPosition.y;
            positions[i * 3 + 2] = currentPosition.z;
            
            if (Math.random() < 0.002) {
                const currentNormal = currentPosition.clone().normalize();
                const randomDir = new THREE.Vector3(
                    (Math.random() - 0.5),
                    (Math.random() - 0.5),
                    (Math.random() - 0.5)
                ).normalize();
                
                const tangentDir = new THREE.Vector3()
                    .crossVectors(currentNormal, randomDir)
                    .normalize()
                    .multiplyScalar(0.09);
                
                pointVelocities[i].lerp(tangentDir, 0.2);
            }
        }
        
        // 更新几何体
        points.geometry.attributes.position.needsUpdate = true;
        modelLines.geometry.attributes.position.needsUpdate = true;
        nearestLines.geometry.attributes.position.needsUpdate = true;
        nearestLines.computeLineDistances();
        
        // 动态更新最近点连接
        const nearestLineIndices = findNearestPointConnections(positions, null, false);
        nearestLines.geometry.setIndex(nearestLineIndices);
        
        renderer.render(scene, camera);
    }
    animate();
}

function onWindowResize() {
    const container = document.getElementById('pointCloud');
    const containerWidth = container.clientWidth;
    const containerHeight = container.clientHeight;
    
    camera.aspect = containerWidth / containerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(containerWidth, containerHeight);
}

function animatePulse(isEntering) {
    const positions = points.geometry.attributes.position.array;
    const originalPositions = new Float32Array(positions);
    const duration = 300;
    const startTime = performance.now();

    function animate() {
        const currentTime = performance.now();
        const elapsed = currentTime - startTime;
        const t = Math.min(elapsed / duration, 1);

        for (let i = 0; i < positions.length; i += 3) {
            let scale;
            if (isEntering) {
                scale = 1 - 0.3 * Math.sin(t * Math.PI);
            } else {
                scale = 1 + 0.3 * Math.sin(t * Math.PI);
            }
            // 保持点的当前相对位置，只改变整体缩放
            const currentR = Math.sqrt(
                positions[i] * positions[i] + 
                positions[i + 1] * positions[i + 1] + 
                positions[i + 2] * positions[i + 2]
            );
            const scaleFactor = (CLOUD_RADIUS * scale) / currentR;
            positions[i] *= scaleFactor;
            positions[i + 1] *= scaleFactor;
            positions[i + 2] *= scaleFactor;
        }
        points.geometry.attributes.position.needsUpdate = true;
        modelLines.geometry.attributes.position.needsUpdate = true;
        nearestLines.geometry.attributes.position.needsUpdate = true;
        nearestLines.computeLineDistances(); // 更新虚线距离

        if (t < 1) {
            requestAnimationFrame(animate);
        }
    }
    animate();
}

function updatePointCloud(responses) {
    responses.forEach((response, index) => {
        const colorValue = response.success ? 
            new THREE.Color(0xffffff) : 
            new THREE.Color(0x999999);
        points.material.uniforms.baseColor.value.copy(colorValue);
    });
}

// 修改findNearestPointConnections函数
function findNearestPointConnections(vertices, specificIndex = null, shouldIgnorePrevious = false, distanceProbs = null) {
    const positions = [];
    const nearestLineIndices = [];
    
    // 将顶点数组转换为位置数组
    for (let i = 0; i < vertices.length; i += 3) {
        positions.push({
            index: i / 3,
            x: vertices[i],
            y: vertices[i + 1],
            z: vertices[i + 2]
        });
    }

    const indicesToProcess = specificIndex !== null ? [specificIndex] : positions.map((_, i) => i);

    indicesToProcess.forEach((index) => {
        const prevConnected = previousConnections[index] || [];
        
        const distances = positions.map((other, otherIndex) => {
            if (index === otherIndex) return { index: otherIndex, distance: Infinity, wasConnected: false };
            const dx = positions[index].x - other.x;
            const dy = positions[index].y - other.y;
            const dz = positions[index].z - other.z;
            return {
                index: otherIndex,
                distance: Math.sqrt(dx * dx + dy * dy + dz * dz),
                wasConnected: prevConnected.includes(otherIndex),
                shouldIgnore: distanceProbs ? distanceProbs.get(`${Math.min(index, otherIndex)}-${Math.max(index, otherIndex)}`) : false
            };
        });

        distances.sort((a, b) => a.distance - b.distance);
        
        const connectionCount = pointConnectionCounts[index];
        const maxDistance = CLOUD_RADIUS * 1.5;
        
        if (shouldIgnorePrevious && prevConnected.length > 0) {
            const prevConnectedDistances = distances.filter(d => d.wasConnected);
            prevConnectedDistances.sort((a, b) => a.distance - b.distance);
            
            const ignoreIndices = new Set(
                prevConnectedDistances
                    .slice(0, Math.max(0, prevConnected.length - 1))
                    .map(d => d.index)
            );
            
            const availablePoints = distances.filter(d => !ignoreIndices.has(d.index) && !d.shouldIgnore);
            
            let connectedCount = 0;
            for (const dist of availablePoints) {
                if (connectedCount >= connectionCount) break;
                if (dist.distance < maxDistance && index < dist.index) {
                    nearestLineIndices.push(index, dist.index);
                    connectedCount++;
                }
            }
        } else {
            let connectedCount = 0;
            for (const dist of distances) {
                if (connectedCount >= connectionCount) break;
                if (!dist.shouldIgnore && dist.distance < maxDistance && index < dist.index) {
                    nearestLineIndices.push(index, dist.index);
                    connectedCount++;
                }
            }
        }
    });

    return nearestLineIndices;
}

// 设置渲染器背景色
renderer.setClearColor(0x111111);  // 深灰色背景