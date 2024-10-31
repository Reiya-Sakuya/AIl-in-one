let points, lines; // 确保points和lines在全局范围内可访问
let renderer, scene, camera;
let rotationSpeed = { x: 0.003, y: 0.003, z: 0.003 }; // 减小整体旋转速度
const CLOUD_RADIUS = 6.0; // 增大点云半径
let pointQuaternions = []; // 存储每个点的四元数
let pointVelocities = []; // 存储每个点的角速度

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

    // 调整相机位置以适应更大的点云
    camera.position.z = 15;
    camera.position.y = 2;
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

    // 初始化每个点的角速度，显著增加游走速度
    for (let i = 0; i < totalPoints; i++) {
        pointVelocities.push(new THREE.Vector3(
            (Math.random() - 0.5) * 0.15, // 从0.05增加到0.15
            (Math.random() - 0.5) * 0.15,
            (Math.random() - 0.5) * 0.15
        ));
    }

    // 修改点材质的设置，增大点的大小
    const material = new THREE.PointsMaterial({ 
        color: 0x00ffcc, 
        size: 0.8,  // 从0.5增加到0.8
        sizeAttenuation: true
    });
    points = new THREE.Points(geometry, material);
    scene.add(points);

    // 修改线条材质的设置
    const lineGeometry = new THREE.BufferGeometry();
    lineGeometry.setAttribute('position', new THREE.BufferAttribute(vertices, 3));
    lineGeometry.setIndex(lineIndices);
    const lineMaterial = new THREE.LineBasicMaterial({ 
        color: 0x00ffcc,
        transparent: true,
        opacity: 0.25,  // 稍微降低一点透明度
        depthWrite: false,
        depthTest: true
    });
    lines = new THREE.LineSegments(lineGeometry, lineMaterial);
    scene.add(lines);

    window.addEventListener('resize', onWindowResize, false);

    document.getElementById('userInput').addEventListener('focus', () => {
        animatePulse(true); // 焦点进入：缩小放大
    });

    document.getElementById('userInput').addEventListener('blur', () => {
        animatePulse(false); // 焦点离开：放大缩小
    });

    function animate() {
        requestAnimationFrame(animate);
        
        // 更新点的位置
        const positions = points.geometry.attributes.position.array;
        for (let i = 0; i < totalPoints; i++) {
            // 创建表示角速度的四元数
            const velocityQuaternion = new THREE.Quaternion();
            velocityQuaternion.setFromAxisAngle(pointVelocities[i], pointVelocities[i].length());
            
            // 更新点的四元数
            pointQuaternions[i].multiply(velocityQuaternion);
            pointQuaternions[i].normalize(); // 确保四元数保持单位长度
            
            // 应用四元数到基础向量
            const baseVector = new THREE.Vector3(0, 0, CLOUD_RADIUS);
            baseVector.applyQuaternion(pointQuaternions[i]);
            
            // 确保点始终在球面上
            const currentPosition = new THREE.Vector3(
                baseVector.x,
                baseVector.y,
                baseVector.z
            ).normalize().multiplyScalar(CLOUD_RADIUS);
            
            // 更新位置
            positions[i * 3] = currentPosition.x;
            positions[i * 3 + 1] = currentPosition.y;
            positions[i * 3 + 2] = currentPosition.z;
            
            // 降低改变方向的频率，并使改变更平滑
            if (Math.random() < 0.002) {
                // 生成新的目标速度，但确保是切向速度
                const currentNormal = currentPosition.clone().normalize();
                const randomDir = new THREE.Vector3(
                    (Math.random() - 0.5),
                    (Math.random() - 0.5),
                    (Math.random() - 0.5)
                ).normalize();
                
                // 使用叉积确保速度方向垂直于球面法线
                const tangentDir = new THREE.Vector3()
                    .crossVectors(currentNormal, randomDir)
                    .normalize()
                    .multiplyScalar(0.15);
                
                // 平滑过渡到新的速度
                pointVelocities[i].lerp(tangentDir, 0.2);
            }
        }
        
        // 更新几何体
        points.geometry.attributes.position.needsUpdate = true;
        lines.geometry.attributes.position.needsUpdate = true;
        
        // 旋转整个点云
        points.rotation.x += rotationSpeed.x;
        points.rotation.y += rotationSpeed.y;
        points.rotation.z += rotationSpeed.z;
        lines.rotation.copy(points.rotation);
        
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
        lines.geometry.attributes.position.needsUpdate = true;

        if (t < 1) {
            requestAnimationFrame(animate);
        }
    }
    animate();
}

function updatePointCloud(responses) {
    // 根据AI模型的响应更新点云
    const positions = points.geometry.attributes.position.array;
    responses.forEach((response, index) => {
        const colorValue = response.success ? 0x00ff00 : 0xff0000; // 成功为绿色，失败为红色
        points.material.color.setHex(colorValue);
    });
    points.geometry.attributes.position.needsUpdate = true;
} 