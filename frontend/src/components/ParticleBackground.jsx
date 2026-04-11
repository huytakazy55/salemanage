import { useEffect, useRef } from 'react';

/**
 * Interactive particle background + MobaXterm-style penguins.
 * Penguins drop from top (slowly), flap wings, land on surfaces, walk facing forward.
 * They can open a hole anywhere, turn their back, shrink into it, and the hole closes.
 */
export default function ParticleBackground() {
    const canvasRef = useRef(null);

    useEffect(() => {
        const canvas = canvasRef.current;
        if (!canvas) return;
        const ctx = canvas.getContext('2d');

        let animId;
        let mouse = { x: -9999, y: -9999 };
        let particles = [];
        let penguins = [];
        let activeHoles = []; // Dynamic holes that open and close
        let galaxies = []; // Static background galaxies
        let shootingStars = []; // Shooting stars
        let shootingStarTimer = 0;
        let spawnTimer = 0;
        const TARGET_PENGUINS = 8;

        // Vibrant Night sky star colors: whites, bright yellows, vivid blues
        const starColors = [
            '#ffffff', '#ffffff', '#ffffff', '#ffffff',  // Bright White (chủ đạo)
            '#ffd700', '#ffea00', '#ffcc00',             // Vàng tươi / Gold (Yellow)
            '#4d94ff', '#00e5ff', '#1e90ff',             // Xanh lam sáng / Xanh lơ (Blue)
            '#ffb84d', '#f0f0ff'                         // Cam nhạt và Trắng lạnh
        ];

        function resize() {
            canvas.width = window.innerWidth;
            canvas.height = window.innerHeight;
        }

        // ==================== STARS (PARTICLES) ====================
        function createParticle() {
            const color = starColors[Math.floor(Math.random() * starColors.length)];
            const size = Math.random() * 2.5 + 0.5;
            const angle = Math.random() * Math.PI * 2;
            const speed = Math.random() * 0.08 + 0.01; // very slow drift
            // Star type: tiny dot, small star, or bright star
            const r = Math.random();
            const starType = r < 0.55 ? 'dot' : r < 0.85 ? 'star4' : 'star6';
            return {
                x: Math.random() * canvas.width,
                y: Math.random() * canvas.height,
                originX: 0, originY: 0,
                vx: Math.cos(angle) * speed,
                vy: Math.sin(angle) * speed,
                color, size, starType,
                alpha: Math.random() * 0.5 + 0.5,
                rotation: Math.random() * Math.PI * 2,
                rotationSpeed: (Math.random() - 0.5) * 0.005,
                twinklePhase: Math.random() * Math.PI * 2,
                twinkleSpeed: Math.random() * 0.03 + 0.01,
                isBlinking: false,
                blinkLife: 0,
            };
        }

        function initGalaxies() {
            galaxies = [];
            const count = Math.random() > 0.5 ? 2 : 3; // 2 to 3 galaxies
            for (let i = 0; i < count; i++) {
                galaxies.push({
                    x: Math.random() * canvas.width,
                    y: Math.random() * canvas.height,
                    radiusX: Math.random() * 300 + 200, // Very wide
                    radiusY: Math.random() * 80 + 50, // Thin ellipse
                    rotation: Math.random() * Math.PI * 2,
                    colorStr: ['37, 99, 235', '147, 51, 234', '219, 39, 119'][Math.floor(Math.random() * 3)], // Deep blue, purple, pink
                    alpha: Math.random() * 0.15 + 0.05
                });
            }
        }

        function drawGalaxies() {
            for (const g of galaxies) {
                ctx.save();
                ctx.translate(g.x, g.y);
                ctx.rotate(g.rotation);
                ctx.globalAlpha = g.alpha;

                // Elliptical gradient glow
                const grd = ctx.createRadialGradient(0, 0, 0, 0, 0, g.radiusX);
                grd.addColorStop(0, `rgba(${g.colorStr}, 0.8)`);
                grd.addColorStop(0.4, `rgba(${g.colorStr}, 0.3)`);
                grd.addColorStop(1, `rgba(${g.colorStr}, 0)`);

                ctx.fillStyle = grd;
                // Squeeze Y axis to form an ellipse
                ctx.scale(1, g.radiusY / g.radiusX);
                ctx.beginPath();
                ctx.arc(0, 0, g.radiusX, 0, Math.PI * 2);
                ctx.fill();

                ctx.restore();
            }
        }

        function initParticles() {
            particles = [];
            const count = Math.min(Math.floor((canvas.width * canvas.height) / 2800), 500);
            for (let i = 0; i < count; i++) {
                const p = createParticle();
                p.originX = p.x;
                p.originY = p.y;
                particles.push(p);
            }
            initGalaxies();
        }

        function drawStar(cx, cy, points, outerR, innerR) {
            ctx.beginPath();
            for (let i = 0; i < points * 2; i++) {
                const r = i % 2 === 0 ? outerR : innerR;
                const a = (i * Math.PI) / points - Math.PI / 2;
                if (i === 0) ctx.moveTo(cx + r * Math.cos(a), cy + r * Math.sin(a));
                else ctx.lineTo(cx + r * Math.cos(a), cy + r * Math.sin(a));
            }
            ctx.closePath();
        }

        function drawParticle(p) {
            // Trigger random slow blink
            if (!p.isBlinking && Math.random() < 0.00015) {
                p.isBlinking = true;
                p.blinkLife = 0;
            }

            let alpha = p.alpha;
            let sizeScale = 1;

            if (p.isBlinking) {
                p.blinkLife++;
                const duration = 150; // Slow pulse over ~2.5 seconds
                if (p.blinkLife >= duration) {
                    p.isBlinking = false;
                } else {
                    const pulse = Math.sin((p.blinkLife / duration) * Math.PI);
                    // Smoothly transition alpha up to 1
                    alpha = p.alpha + pulse * (1 - p.alpha);
                    // Subtle dynamic size increase
                    sizeScale = 1 + pulse * 0.4;
                }
            } else {
                // Normal subtle twinkling
                const twinkle = Math.sin(Date.now() * p.twinkleSpeed * 0.06 + p.twinklePhase);
                alpha = p.alpha * (0.8 + twinkle * 0.2);
            }

            if (alpha <= 0.02) return;

            ctx.save();
            ctx.translate(p.x, p.y);
            ctx.rotate(p.rotation);
            ctx.globalAlpha = alpha;

            const s = p.size * sizeScale;

            switch (p.starType) {
                case 'dot':
                    // Tiny angular pointy star instead of a round dot
                    ctx.fillStyle = p.color;
                    drawStar(0, 0, 4, s * 0.9, s * 0.3);
                    ctx.fill();
                    break;

                case 'star4': {
                    // 4-pointed star with glow
                    // Glow
                    const grd = ctx.createRadialGradient(0, 0, 0, 0, 0, s * 3);
                    grd.addColorStop(0, p.color);
                    grd.addColorStop(0.3, p.color.replace(')', ',0.3)').replace('rgb', 'rgba'));
                    grd.addColorStop(1, 'rgba(255,255,255,0)');
                    ctx.fillStyle = grd;
                    ctx.beginPath();
                    ctx.arc(0, 0, s * 3, 0, Math.PI * 2);
                    ctx.fill();

                    // Star shape
                    ctx.fillStyle = p.color;
                    drawStar(0, 0, 4, s * 1.8, s * 0.5);
                    ctx.fill();
                    break;
                }

                case 'star6': {
                    // 6-pointed bright star with bigger glow
                    const grd2 = ctx.createRadialGradient(0, 0, 0, 0, 0, s * 5);
                    grd2.addColorStop(0, '#ffffff');
                    grd2.addColorStop(0.15, p.color);
                    grd2.addColorStop(0.4, 'rgba(255,255,255,0.1)');
                    grd2.addColorStop(1, 'rgba(255,255,255,0)');
                    ctx.fillStyle = grd2;
                    ctx.beginPath();
                    ctx.arc(0, 0, s * 5, 0, Math.PI * 2);
                    ctx.fill();

                    // Cross flare
                    ctx.strokeStyle = `rgba(255,255,255,${alpha * 0.4})`;
                    ctx.lineWidth = 0.5;
                    ctx.beginPath();
                    ctx.moveTo(-s * 4, 0); ctx.lineTo(s * 4, 0);
                    ctx.moveTo(0, -s * 4); ctx.lineTo(0, s * 4);
                    ctx.stroke();

                    // Star core
                    ctx.fillStyle = '#fff';
                    drawStar(0, 0, 6, s * 2, s * 0.7);
                    ctx.fill();
                    break;
                }
            }
            ctx.restore();
        }

        // ==================== SHOOTING STARS ====================
        function createShootingStar() {
            // Start from top area, fly mostly horizontally left or right
            const goLeft = Math.random() > 0.5; // 50/50 chance
            const angle = goLeft
                ? Math.PI * (0.90 + Math.random() * 0.08) // Nearly horizontal left (slight downward tilt)
                : Math.PI * (0.02 + Math.random() * 0.08); // Nearly horizontal right (slight downward tilt)
            const speed = Math.random() * 6 + 8; // fast!
            return {
                x: goLeft ? canvas.width * (0.3 + Math.random() * 0.7) : Math.random() * canvas.width * 0.5,
                y: Math.random() * canvas.height * 0.3,
                vx: Math.cos(angle) * speed,
                vy: Math.sin(angle) * speed,
                life: 0,
                maxLife: Math.random() * 30 + 35, // ~35-65 frames
                tailLength: Math.random() * 40 + 60,
                size: Math.random() * 1.5 + 1.5,
                sparkles: [], // trail sparkles
            };
        }

        function updateShootingStars() {
            for (let i = shootingStars.length - 1; i >= 0; i--) {
                const ss = shootingStars[i];
                ss.x += ss.vx;
                ss.y += ss.vy;
                ss.life++;

                // Add sparkle trail
                if (ss.life % 2 === 0) {
                    ss.sparkles.push({
                        x: ss.x + (Math.random() - 0.5) * 4,
                        y: ss.y + (Math.random() - 0.5) * 4,
                        alpha: 0.7,
                        size: Math.random() * 1.2 + 0.3,
                    });
                }

                // Fade sparkles
                for (let j = ss.sparkles.length - 1; j >= 0; j--) {
                    ss.sparkles[j].alpha -= 0.04;
                    if (ss.sparkles[j].alpha <= 0) ss.sparkles.splice(j, 1);
                }

                if (ss.life >= ss.maxLife || ss.x < -50 || ss.x > canvas.width + 50 || ss.y > canvas.height + 50) {
                    shootingStars.splice(i, 1);
                }
            }
        }

        function drawShootingStars() {
            for (const ss of shootingStars) {
                const progress = ss.life / ss.maxLife;
                const fadeIn = Math.min(1, ss.life / 5);
                const fadeOut = Math.max(0, 1 - (progress - 0.7) / 0.3);
                const alpha = fadeIn * (progress > 0.7 ? fadeOut : 1);

                // Tail (gradient line trailing behind)
                const tailX = ss.x - (ss.vx / Math.sqrt(ss.vx * ss.vx + ss.vy * ss.vy)) * ss.tailLength * alpha;
                const tailY = ss.y - (ss.vy / Math.sqrt(ss.vx * ss.vx + ss.vy * ss.vy)) * ss.tailLength * alpha;

                const gradient = ctx.createLinearGradient(tailX, tailY, ss.x, ss.y);
                gradient.addColorStop(0, 'rgba(255,255,255,0)');
                gradient.addColorStop(0.6, `rgba(255,250,220,${0.3 * alpha})`);
                gradient.addColorStop(1, `rgba(255,255,255,${0.9 * alpha})`);

                ctx.strokeStyle = gradient;
                ctx.lineWidth = ss.size * 0.8;
                ctx.lineCap = 'round';
                ctx.beginPath();
                ctx.moveTo(tailX, tailY);
                ctx.lineTo(ss.x, ss.y);
                ctx.stroke();

                // Bright head glow
                const headGlow = ctx.createRadialGradient(ss.x, ss.y, 0, ss.x, ss.y, ss.size * 6);
                headGlow.addColorStop(0, `rgba(255,255,255,${alpha})`);
                headGlow.addColorStop(0.2, `rgba(255,250,200,${0.5 * alpha})`);
                headGlow.addColorStop(1, 'rgba(255,255,255,0)');
                ctx.fillStyle = headGlow;
                ctx.beginPath();
                ctx.arc(ss.x, ss.y, ss.size * 6, 0, Math.PI * 2);
                ctx.fill();

                // Head core
                ctx.fillStyle = `rgba(255,255,255,${alpha})`;
                ctx.beginPath();
                ctx.arc(ss.x, ss.y, ss.size, 0, Math.PI * 2);
                ctx.fill();

                // Trail sparkles
                for (const sp of ss.sparkles) {
                    ctx.fillStyle = `rgba(255,250,220,${sp.alpha * alpha})`;
                    ctx.beginPath();
                    ctx.arc(sp.x, sp.y, sp.size, 0, Math.PI * 2);
                    ctx.fill();
                }
            }
        }

        // ==================== DYNAMIC HOLES ====================
        // Holes appear where a penguin decides to exit, animate open, penguin enters, then close
        function createHole(x, y) {
            return {
                x, y,
                openProgress: 0, // 0 = closed, 1 = fully open
                state: 'opening', // opening, open, closing, done
                flapSize: 28,
            };
        }

        function updateHoles() {
            for (let i = activeHoles.length - 1; i >= 0; i--) {
                const h = activeHoles[i];
                switch (h.state) {
                    case 'opening':
                        h.openProgress += 0.03;
                        if (h.openProgress >= 1) {
                            h.openProgress = 1;
                            h.state = 'open';
                        }
                        break;
                    case 'open':
                        break;
                    case 'closing':
                        h.openProgress -= 0.025;
                        if (h.openProgress <= 0) {
                            h.openProgress = 0;
                            h.state = 'done';
                        }
                        break;
                }
                if (h.state === 'done') {
                    activeHoles.splice(i, 1);
                }
            }
        }

        function drawHole(h) {
            if (h.openProgress <= 0) return;
            ctx.save();
            ctx.translate(h.x, h.y);

            const prog = h.openProgress;
            const sz = h.flapSize * prog;

            // Dark opening underneath (the space revealed by peeling)
            ctx.fillStyle = `rgba(0,0,0,${0.75 * prog})`;
            ctx.beginPath();
            ctx.moveTo(-sz * 0.8, 0);
            ctx.quadraticCurveTo(-sz * 0.3, -sz * 0.15, 0, -sz * 0.2);
            ctx.quadraticCurveTo(sz * 0.3, -sz * 0.15, sz * 0.8, 0);
            ctx.quadraticCurveTo(sz * 0.3, sz * 0.08, 0, sz * 0.1);
            ctx.quadraticCurveTo(-sz * 0.3, sz * 0.08, -sz * 0.8, 0);
            ctx.closePath();
            ctx.fill();

            // Inner shadow gradient
            const grd = ctx.createRadialGradient(0, -sz * 0.05, 0, 0, -sz * 0.05, sz * 0.6);
            grd.addColorStop(0, `rgba(0,0,0,${0.4 * prog})`);
            grd.addColorStop(1, 'rgba(0,0,0,0)');
            ctx.fillStyle = grd;
            ctx.beginPath();
            ctx.ellipse(0, -sz * 0.05, sz * 0.7, sz * 0.15, 0, 0, Math.PI * 2);
            ctx.fill();

            // Paper flap curling up (the peeled part)
            const curlHeight = sz * 0.55 * prog;
            const curlWidth = sz * 0.7;

            // Flap shadow
            ctx.fillStyle = `rgba(0,0,0,${0.15 * prog})`;
            ctx.beginPath();
            ctx.ellipse(0, -curlHeight * 0.3, curlWidth * 0.7, 3, 0, 0, Math.PI * 2);
            ctx.fill();

            // The flap itself (curling up and back)
            ctx.fillStyle = `rgba(30,30,50,${0.9 * prog})`;
            ctx.beginPath();
            ctx.moveTo(-curlWidth, 0);
            ctx.quadraticCurveTo(-curlWidth * 0.5, -curlHeight * 1.2, 0, -curlHeight);
            ctx.quadraticCurveTo(curlWidth * 0.5, -curlHeight * 1.2, curlWidth, 0);
            ctx.closePath();
            ctx.fill();

            // Flap highlight (paper edge catching light)
            ctx.strokeStyle = `rgba(255,255,255,${0.2 * prog})`;
            ctx.lineWidth = 1;
            ctx.beginPath();
            ctx.moveTo(-curlWidth, 0);
            ctx.quadraticCurveTo(-curlWidth * 0.5, -curlHeight * 1.2, 0, -curlHeight);
            ctx.quadraticCurveTo(curlWidth * 0.5, -curlHeight * 1.2, curlWidth, 0);
            ctx.stroke();

            // Subtle curl fold line (3D effect)
            ctx.strokeStyle = `rgba(255,255,255,${0.08 * prog})`;
            ctx.lineWidth = 0.5;
            ctx.beginPath();
            ctx.moveTo(-curlWidth * 0.8, -1);
            ctx.quadraticCurveTo(0, -curlHeight * 0.3, curlWidth * 0.8, -1);
            ctx.stroke();

            ctx.restore();
        }

        // ==================== SURFACES ====================
        let cachedSurfaces = [];
        let lastSurfaceUpdate = 0;

        function getSurfaces() {
            const now = Date.now();
            if (now - lastSurfaceUpdate < 500) return cachedSurfaces;

            const surfaces = [
                { x: -100, y: canvas.height, width: canvas.width + 200, type: 'ground' }
            ];
            const elements = document.querySelectorAll('.card, .topbar, [data-login-card], .stat-card');
            for (let i = 0; i < elements.length; i++) {
                const rect = elements[i].getBoundingClientRect();
                // Ensure the surface is visible on screen
                if (rect.width > 0 && rect.height > 0 && rect.top > 0 && rect.bottom <= canvas.height + 50) {
                    surfaces.push({ x: rect.left, y: rect.top, width: rect.width, type: 'card' });
                }
            }

            cachedSurfaces = surfaces;
            lastSurfaceUpdate = now;
            return surfaces;
        }

        // ==================== PENGUINS ====================
        function createPenguin() {
            const scale = Math.random() * 0.2 + 0.8;
            return {
                x: Math.random() * (canvas.width - 100) + 50,
                y: -30 - Math.random() * 80,
                scale,
                direction: Math.random() > 0.5 ? 1 : -1,
                speed: Math.random() * 0.2 + 0.15,       // SLOW walking
                fallSpeed: Math.random() * 0.15 + 0.25,   // SLOW falling
                frame: 0,
                frameTimer: 0,
                frameSpeed: 5,
                state: 'falling',
                landedY: canvas.height,
                surfaceLeft: 0,
                surfaceRight: canvas.width,
                idleTimer: 0,
                idleDuration: 0,
                rollAngle: 0,
                rollDirection: 1,
                rollingTimer: 0,
                bellyTimer: 0,
                bobOffset: Math.random() * Math.PI * 2,
                personality: Math.random(),
                holeScale: 1,
                holeRef: null, // reference to the hole this penguin is using
                turnTimer: 0,  // timer for turning back before entering hole
            };
        }

        // --- DRAW: Falling penguin (front view, flapping) ---
        function drawPenguinFalling(pg) {
            ctx.save();
            ctx.translate(pg.x, pg.y);
            ctx.scale(pg.scale, pg.scale);
            const s = 1;
            const t = pg.frame * 0.15;
            ctx.rotate(Math.sin(t * 1.5) * 0.05);

            // Body
            ctx.fillStyle = '#1a1a2e';
            ctx.beginPath(); ctx.ellipse(0, 0, 9 * s, 11 * s, 0, 0, Math.PI * 2); ctx.fill();
            ctx.fillStyle = '#f0f0f0';
            ctx.beginPath(); ctx.ellipse(0, 2 * s, 6 * s, 8 * s, 0, 0, Math.PI * 2); ctx.fill();

            // Wings flapping - arm-like from shoulder
            const flapUp = Math.sin(t * 3);
            const flapY = flapUp * 8;
            ctx.fillStyle = '#2a2a3e';
            ctx.save();
            ctx.translate(-9 * s, -4 * s);
            ctx.beginPath();
            ctx.moveTo(0, 0);
            ctx.quadraticCurveTo(-6 * s, -2 * s - flapY * 0.7, -10 * s, 2 * s - flapY);
            ctx.quadraticCurveTo(-8 * s, 4 * s - flapY * 0.5, -4 * s, 6 * s - flapY * 0.3);
            ctx.quadraticCurveTo(-2 * s, 4 * s, 0, 2 * s);
            ctx.closePath();
            ctx.lineJoin = 'round'; ctx.lineWidth = 3 * s; ctx.strokeStyle = '#2a2a3e'; ctx.stroke();
            ctx.fill();
            ctx.restore();
            ctx.save();
            ctx.translate(9 * s, -4 * s);
            ctx.beginPath();
            ctx.moveTo(0, 0);
            ctx.quadraticCurveTo(6 * s, -2 * s - flapY * 0.7, 10 * s, 2 * s - flapY);
            ctx.quadraticCurveTo(8 * s, 4 * s - flapY * 0.5, 4 * s, 6 * s - flapY * 0.3);
            ctx.quadraticCurveTo(2 * s, 4 * s, 0, 2 * s);
            ctx.closePath();
            ctx.lineJoin = 'round'; ctx.lineWidth = 3 * s; ctx.strokeStyle = '#2a2a3e'; ctx.stroke();
            ctx.fill();
            ctx.restore();

            // Head
            ctx.fillStyle = '#1a1a2e';
            ctx.beginPath(); ctx.arc(0, -11 * s, 7 * s, 0, Math.PI * 2); ctx.fill();
            ctx.fillStyle = '#f0f0f0';
            ctx.beginPath(); ctx.ellipse(0, -9 * s, 5 * s, 4 * s, 0, 0, Math.PI * 2); ctx.fill();

            // Worried eyes
            ctx.fillStyle = '#111';
            ctx.beginPath(); ctx.arc(-2 * s, -10 * s, 1.2 * s, 0, Math.PI * 2); ctx.fill();
            ctx.beginPath(); ctx.arc(2 * s, -10 * s, 1.2 * s, 0, Math.PI * 2); ctx.fill();
            ctx.fillStyle = '#fff';
            ctx.beginPath(); ctx.arc(-1.5 * s, -10.5 * s, 0.5 * s, 0, Math.PI * 2); ctx.fill();
            ctx.beginPath(); ctx.arc(2.5 * s, -10.5 * s, 0.5 * s, 0, Math.PI * 2); ctx.fill();

            // Open beak
            ctx.fillStyle = '#F5A623';
            ctx.beginPath(); ctx.moveTo(-2 * s, -8 * s); ctx.lineTo(2 * s, -8 * s); ctx.lineTo(0, -5.5 * s); ctx.closePath(); ctx.fill();

            // Dangling feet
            const footDangle = Math.sin(t * 2) * 2;
            ctx.fillStyle = '#F5A623';
            ctx.beginPath(); ctx.ellipse(-3 * s, 11 * s + footDangle, 3 * s, 1.5 * s, 0.2, 0, Math.PI * 2); ctx.fill();
            ctx.beginPath(); ctx.ellipse(3 * s, 11 * s - footDangle, 3 * s, 1.5 * s, -0.2, 0, Math.PI * 2); ctx.fill();

            ctx.restore();
        }

        // --- DRAW: Walking penguin (SIDE VIEW) ---
        function drawPenguinSide(pg) {
            ctx.save();
            ctx.translate(pg.x, pg.landedY);
            const sc = pg.scale * pg.holeScale;
            ctx.scale(pg.direction * sc, sc);

            const s = 1;
            const walkCycle = pg.state === 'walking' ? pg.frame * 0.12 : 0;
            const bob = pg.state === 'walking' ? Math.sin(walkCycle * 2) * 1.2 : 0;
            const tilt = pg.state === 'walking' ? Math.sin(walkCycle * 2) * 0.04 : 0;
            ctx.translate(0, bob);
            ctx.rotate(tilt);

            // Shadow
            ctx.fillStyle = 'rgba(0,0,0,0.15)';
            ctx.beginPath(); ctx.ellipse(0, 2 * s, 7 * s, 2 * s, 0, 0, Math.PI * 2); ctx.fill();

            // Foot (back)
            const legBack = pg.state === 'walking' ? Math.sin(walkCycle * 2 + Math.PI) * 4 : 0;
            ctx.fillStyle = '#E89A00';
            ctx.beginPath(); ctx.ellipse(legBack, 0, 3.5 * s, 1.5 * s, 0, 0, Math.PI * 2); ctx.fill();

            // Tail
            ctx.fillStyle = '#1a1a2e';
            ctx.beginPath();
            ctx.moveTo(-6 * s, -4 * s);
            ctx.quadraticCurveTo(-10 * s, -6 * s, -8 * s, -9 * s);
            ctx.quadraticCurveTo(-6 * s, -7 * s, -5 * s, -8 * s);
            ctx.fill();

            // Body
            ctx.fillStyle = '#1a1a2e';
            ctx.beginPath(); ctx.ellipse(0, -10 * s, 7 * s, 11 * s, 0, 0, Math.PI * 2); ctx.fill();
            ctx.fillStyle = '#f0f0f0';
            ctx.beginPath(); ctx.ellipse(2 * s, -8 * s, 4.5 * s, 8 * s, 0.1, 0, Math.PI * 2); ctx.fill();

            // Wing (arm-like, tucked)
            const wingSwing = pg.state === 'walking' ? Math.sin(walkCycle * 2) * 2 : 0;
            ctx.fillStyle = '#2a2a3e';
            ctx.save();
            ctx.translate(0, -11 * s);
            ctx.rotate(wingSwing * 0.05 + 0.2);
            ctx.beginPath();
            ctx.ellipse(-1 * s, 4 * s, 2.5 * s, 6 * s, -0.2, 0, Math.PI * 2);
            ctx.fill();
            ctx.restore();

            // Foot (front)
            const legFront = pg.state === 'walking' ? Math.sin(walkCycle * 2) * 4 : 0;
            ctx.fillStyle = '#F5A623';
            ctx.beginPath(); ctx.ellipse(legFront + 1, 0, 3.5 * s, 1.5 * s, 0, 0, Math.PI * 2); ctx.fill();

            // Head
            ctx.fillStyle = '#1a1a2e';
            ctx.beginPath(); ctx.arc(2 * s, -20 * s, 6.5 * s, 0, Math.PI * 2); ctx.fill();
            ctx.fillStyle = '#f0f0f0';
            ctx.beginPath(); ctx.ellipse(4 * s, -19 * s, 4 * s, 3.5 * s, 0, 0, Math.PI * 2); ctx.fill();

            // Eye
            const blinking = Math.sin(Date.now() * 0.003 + pg.bobOffset * 100) > 0.93;
            if (blinking) {
                ctx.strokeStyle = '#111'; ctx.lineWidth = 1.2;
                ctx.beginPath(); ctx.moveTo(4 * s, -20 * s); ctx.lineTo(6.5 * s, -20 * s); ctx.stroke();
            } else {
                ctx.fillStyle = '#111';
                ctx.beginPath(); ctx.arc(5 * s, -20 * s, 1.3 * s, 0, Math.PI * 2); ctx.fill();
                ctx.fillStyle = '#fff';
                ctx.beginPath(); ctx.arc(5.5 * s, -20.5 * s, 0.5 * s, 0, Math.PI * 2); ctx.fill();
            }

            // Beak
            ctx.fillStyle = '#F5A623';
            ctx.beginPath();
            ctx.moveTo(7.5 * s, -19 * s); ctx.lineTo(11 * s, -18 * s); ctx.lineTo(7.5 * s, -17 * s);
            ctx.closePath(); ctx.fill();

            // Blush
            ctx.fillStyle = 'rgba(255, 130, 150, 0.3)';
            ctx.beginPath(); ctx.ellipse(6.5 * s, -17.5 * s, 1.5 * s, 1 * s, 0, 0, Math.PI * 2); ctx.fill();

            ctx.restore();
        }

        // --- DRAW: Penguin BACK VIEW (turning away before entering hole) ---
        function drawPenguinBack(pg) {
            ctx.save();
            ctx.translate(pg.x, pg.landedY);
            const sc = pg.scale * pg.holeScale;
            ctx.scale(sc, sc);
            const s = 1;

            // Shadow
            ctx.fillStyle = 'rgba(0,0,0,0.15)';
            ctx.beginPath(); ctx.ellipse(0, 2 * s, 7 * s, 2 * s, 0, 0, Math.PI * 2); ctx.fill();

            // Feet (visible from behind)
            ctx.fillStyle = '#F5A623';
            ctx.beginPath(); ctx.ellipse(-3.5 * s, 0, 3 * s, 1.5 * s, 0, 0, Math.PI * 2); ctx.fill();
            ctx.beginPath(); ctx.ellipse(3.5 * s, 0, 3 * s, 1.5 * s, 0, 0, Math.PI * 2); ctx.fill();

            // Body - all black from behind (no belly visible)
            ctx.fillStyle = '#1a1a2e';
            ctx.beginPath(); ctx.ellipse(0, -10 * s, 8 * s, 11 * s, 0, 0, Math.PI * 2); ctx.fill();

            // Wings tucked at sides (arm-like)
            ctx.fillStyle = '#2a2a3e';
            // Left wing
            ctx.save();
            ctx.translate(-7 * s, -10 * s);
            ctx.rotate(0.3);
            ctx.beginPath();
            ctx.ellipse(0, 4 * s, 2.5 * s, 6 * s, 0, 0, Math.PI * 2);
            ctx.fill();
            ctx.restore();
            // Right wing
            ctx.save();
            ctx.translate(7 * s, -10 * s);
            ctx.rotate(-0.3);
            ctx.beginPath();
            ctx.ellipse(0, 4 * s, 2.5 * s, 6 * s, 0, 0, Math.PI * 2);
            ctx.fill();
            ctx.restore();

            // Tail (visible from behind, small triangle)
            ctx.fillStyle = '#1a1a2e';
            ctx.beginPath();
            ctx.moveTo(-2 * s, -1 * s);
            ctx.lineTo(0, -4 * s);
            ctx.lineTo(2 * s, -1 * s);
            ctx.closePath(); ctx.fill();

            // Back of head (all black, no face)
            ctx.fillStyle = '#1a1a2e';
            ctx.beginPath(); ctx.arc(0, -20 * s, 7 * s, 0, Math.PI * 2); ctx.fill();

            // Small white patches on sides of head (barely visible from behind)
            ctx.fillStyle = '#e8e8e8';
            ctx.beginPath(); ctx.ellipse(-5 * s, -19 * s, 2 * s, 2.5 * s, -0.2, 0, Math.PI * 2); ctx.fill();
            ctx.beginPath(); ctx.ellipse(5 * s, -19 * s, 2 * s, 2.5 * s, 0.2, 0, Math.PI * 2); ctx.fill();

            ctx.restore();
        }

        // --- DRAW: Rolling penguin ---
        function drawPenguinRolling(pg) {
            ctx.save();
            ctx.translate(pg.x, pg.landedY);
            const sc = pg.scale * pg.holeScale;
            ctx.scale(pg.rollDirection * sc, sc);
            const s = 1;

            // The penguin curls into a ball and tumbles forward
            // Bounce up slightly during the tumble
            const tumbleCycle = pg.rollAngle;
            const bounceY = -Math.abs(Math.sin(tumbleCycle)) * 6;

            ctx.translate(0, bounceY);

            // Shadow (moves/scales with bounce)
            ctx.fillStyle = `rgba(0,0,0,${0.12 - bounceY * 0.005})`;
            ctx.beginPath(); ctx.ellipse(0, -bounceY + 2 * s, (8 + bounceY * 0.3) * s, 2 * s, 0, 0, Math.PI * 2); ctx.fill();

            // Rotate penguin like a ball
            ctx.translate(0, -8 * s);
            ctx.rotate(tumbleCycle);
            ctx.translate(0, 8 * s);

            // Compact curled body (ball shape)
            ctx.fillStyle = '#1a1a2e';
            ctx.beginPath(); ctx.arc(0, -8 * s, 10 * s, 0, Math.PI * 2); ctx.fill();

            // Belly peek
            ctx.fillStyle = '#f0f0f0';
            ctx.beginPath(); ctx.ellipse(0, -6 * s, 6 * s, 7 * s, 0, 0, Math.PI * 2); ctx.fill();

            // Feet tucked in
            ctx.fillStyle = '#F5A623';
            ctx.beginPath(); ctx.ellipse(-3 * s, 2 * s, 2.5 * s, 1.5 * s, 0.3, 0, Math.PI * 2); ctx.fill();
            ctx.beginPath(); ctx.ellipse(3 * s, 2 * s, 2.5 * s, 1.5 * s, -0.3, 0, Math.PI * 2); ctx.fill();

            // Wings wrapped around body
            ctx.fillStyle = '#2a2a3e';
            ctx.save(); ctx.translate(-8 * s, -8 * s);
            ctx.rotate(-0.5);
            ctx.beginPath(); ctx.ellipse(-2 * s, 2 * s, 2.5 * s, 5 * s, 0, 0, Math.PI * 2);
            ctx.fill(); ctx.restore();
            ctx.save(); ctx.translate(8 * s, -8 * s);
            ctx.rotate(0.5);
            ctx.beginPath(); ctx.ellipse(2 * s, 2 * s, 2.5 * s, 5 * s, 0, 0, Math.PI * 2);
            ctx.fill(); ctx.restore();

            // Head tucked
            ctx.fillStyle = '#1a1a2e';
            ctx.beginPath(); ctx.arc(0, -16 * s, 5.5 * s, 0, Math.PI * 2); ctx.fill();

            // Dizzy spiral eyes
            ctx.strokeStyle = '#888'; ctx.lineWidth = 1;
            // Left spiral
            ctx.beginPath();
            for (let a = 0; a < Math.PI * 3; a += 0.2) {
                const sr = a * 0.4;
                const sx = -2 * s + Math.cos(a + Date.now() * 0.005) * sr;
                const sy = -16 * s + Math.sin(a + Date.now() * 0.005) * sr;
                if (a === 0) ctx.moveTo(sx, sy); else ctx.lineTo(sx, sy);
            }
            ctx.stroke();
            // Right spiral
            ctx.beginPath();
            for (let a = 0; a < Math.PI * 3; a += 0.2) {
                const sr = a * 0.4;
                const sx = 2 * s + Math.cos(a + Date.now() * 0.005 + 1) * sr;
                const sy = -16 * s + Math.sin(a + Date.now() * 0.005 + 1) * sr;
                if (a === 0) ctx.moveTo(sx, sy); else ctx.lineTo(sx, sy);
            }
            ctx.stroke();

            // Beak
            ctx.fillStyle = '#F5A623';
            ctx.beginPath(); ctx.moveTo(-1 * s, -14.5 * s); ctx.lineTo(1 * s, -14.5 * s); ctx.lineTo(0, -13 * s); ctx.closePath(); ctx.fill();

            ctx.restore();
        }

        // --- DRAW: Belly slide ---
        function drawPenguinBelly(pg) {
            ctx.save();
            ctx.translate(pg.x, pg.landedY);
            const sc = pg.scale * pg.holeScale;
            ctx.scale(pg.direction * sc, sc);
            const s = 1;

            ctx.fillStyle = 'rgba(0,0,0,0.12)';
            ctx.beginPath(); ctx.ellipse(0, 2 * s, 12 * s, 2 * s, 0, 0, Math.PI * 2); ctx.fill();

            ctx.translate(0, -4 * s);
            ctx.rotate(-Math.PI * 0.1);

            ctx.fillStyle = '#1a1a2e';
            ctx.beginPath(); ctx.ellipse(0, 0, 14 * s, 7 * s, 0, 0, Math.PI * 2); ctx.fill();
            ctx.fillStyle = '#f0f0f0';
            ctx.beginPath(); ctx.ellipse(0, 2 * s, 10 * s, 4 * s, 0, 0, Math.PI * 2); ctx.fill();

            ctx.fillStyle = '#1a1a2e';
            ctx.beginPath(); ctx.arc(12 * s, -2 * s, 6 * s, 0, Math.PI * 2); ctx.fill();
            ctx.fillStyle = '#f0f0f0';
            ctx.beginPath(); ctx.ellipse(13 * s, -1 * s, 4 * s, 3 * s, 0, 0, Math.PI * 2); ctx.fill();

            ctx.fillStyle = '#111';
            ctx.beginPath(); ctx.arc(11.5 * s, -2.5 * s, 1 * s, 0, Math.PI * 2); ctx.fill();
            ctx.beginPath(); ctx.arc(14.5 * s, -2.5 * s, 1 * s, 0, Math.PI * 2); ctx.fill();
            ctx.fillStyle = '#fff';
            ctx.beginPath(); ctx.arc(12 * s, -3 * s, 0.4 * s, 0, Math.PI * 2); ctx.fill();
            ctx.beginPath(); ctx.arc(15 * s, -3 * s, 0.4 * s, 0, Math.PI * 2); ctx.fill();

            ctx.fillStyle = '#F5A623';
            ctx.beginPath(); ctx.moveTo(16 * s, -1 * s); ctx.lineTo(19 * s, 0); ctx.lineTo(16 * s, 1 * s); ctx.closePath(); ctx.fill();

            ctx.fillStyle = '#2a2a3e';
            ctx.save(); ctx.translate(4 * s, -6 * s); ctx.rotate(-0.3);
            ctx.beginPath(); ctx.ellipse(0, 0, 5 * s, 2.5 * s, 0, 0, Math.PI * 2); ctx.fill(); ctx.restore();
            ctx.save(); ctx.translate(4 * s, 5 * s); ctx.rotate(0.3);
            ctx.beginPath(); ctx.ellipse(0, 0, 5 * s, 2.5 * s, 0, 0, Math.PI * 2); ctx.fill(); ctx.restore();

            const kick = Math.sin(pg.frame * 0.2) * 2;
            ctx.fillStyle = '#F5A623';
            ctx.beginPath(); ctx.ellipse(-13 * s, -2 * s + kick, 1.5 * s, 3 * s, 0, 0, Math.PI * 2); ctx.fill();
            ctx.beginPath(); ctx.ellipse(-13 * s, 3 * s - kick, 1.5 * s, 3 * s, 0, 0, Math.PI * 2); ctx.fill();

            ctx.fillStyle = 'rgba(255, 130, 150, 0.4)';
            ctx.beginPath(); ctx.ellipse(10 * s, 0.5 * s, 1.5 * s, 1 * s, 0, 0, Math.PI * 2); ctx.fill();
            ctx.beginPath(); ctx.ellipse(16 * s, 0.5 * s, 1.5 * s, 1 * s, 0, 0, Math.PI * 2); ctx.fill();

            ctx.restore();
        }

        // ==================== UPDATE ====================
        function startExitSequence(pg) {
            // Create a hole at the penguin's current position
            const hole = createHole(pg.x, pg.landedY);
            activeHoles.push(hole);
            pg.holeRef = hole;
            pg.state = 'waiting-hole'; // wait for hole to open
            pg.holeScale = 1;
        }

        function updatePenguin(pg) {
            pg.frameTimer++;
            if (pg.frameTimer >= pg.frameSpeed) { pg.frameTimer = 0; pg.frame++; }

            const surfaces = getSurfaces();

            switch (pg.state) {
                case 'falling': {
                    pg.y += pg.fallSpeed;
                    for (const surf of surfaces) {
                        const bottom = pg.y + 12 * pg.scale;
                        if (bottom >= surf.y && bottom - pg.fallSpeed * 2 < surf.y &&
                            pg.x >= surf.x - 5 && pg.x <= surf.x + surf.width + 5) {
                            pg.state = 'landing';
                            pg.landedY = surf.y;
                            pg.surfaceLeft = surf.x;
                            pg.surfaceRight = surf.x + surf.width;
                            pg.idleTimer = 0;
                            pg.idleDuration = 20;
                            break;
                        }
                    }
                    if (pg.y > canvas.height + 100) pg.state = 'dead';
                    break;
                }

                case 'landing': {
                    pg.idleTimer++;
                    if (pg.idleTimer >= pg.idleDuration) {
                        pg.state = 'walking';
                        pg.direction = Math.random() > 0.5 ? 1 : -1;
                    }
                    break;
                }

                case 'walking': {
                    pg.x += pg.speed * pg.direction;

                    const onCard = pg.surfaceRight - pg.surfaceLeft < canvas.width - 10;

                    if (onCard) {
                        if (pg.x < pg.surfaceLeft - 3 || pg.x > pg.surfaceRight + 3) {
                            pg.state = 'falling';
                            break;
                        }
                    }

                    // Random behaviors
                    if (Math.random() < 0.004) {
                        pg.state = 'idle';
                        pg.idleDuration = Math.random() * 120 + 40;
                        pg.idleTimer = 0;
                    }
                    if (Math.random() < 0.002) pg.direction *= -1;

                    // Random: decide to exit through a hole (ground only)
                    if (!onCard && Math.random() < 0.0008) {
                        startExitSequence(pg);
                        break;
                    }

                    // Random belly-slide
                    if (!onCard && pg.personality > 0.4 && Math.random() < 0.001) {
                        pg.state = 'belly-slide';
                        pg.speed = Math.random() * 0.8 + 0.6;
                        pg.bellyTimer = 0;
                    }

                    // Random rolling
                    if (!onCard && pg.personality > 0.65 && Math.random() < 0.0008) {
                        pg.state = 'rolling';
                        pg.rollAngle = 0;
                        pg.rollDirection = pg.direction;
                        pg.rollingTimer = 0;
                    }

                    // Wrap
                    if (!onCard) {
                        if (pg.x > canvas.width + 20) pg.x = -15;
                        if (pg.x < -20) pg.x = canvas.width + 15;
                    }
                    break;
                }

                case 'idle': {
                    pg.idleTimer++;
                    if (pg.idleTimer >= pg.idleDuration) {
                        pg.state = 'walking';
                        if (Math.random() < 0.3) pg.direction *= -1;
                    }
                    // Idle penguin may decide to exit
                    if (Math.random() < 0.0005) {
                        const onCard = pg.surfaceRight - pg.surfaceLeft < canvas.width - 10;
                        if (!onCard) {
                            startExitSequence(pg);
                        }
                    }
                    break;
                }

                case 'rolling': {
                    pg.rollingTimer++;
                    pg.rollAngle += pg.rollDirection * 0.15;
                    pg.x += pg.rollDirection * 0.8;

                    if (pg.rollingTimer > 80) {
                        pg.state = 'idle';
                        pg.idleTimer = 0;
                        pg.idleDuration = 50; // dizzy pause after tumbling
                        pg.rollAngle = 0;
                    }

                    const onCard = pg.surfaceRight - pg.surfaceLeft < canvas.width - 10;
                    if (onCard && (pg.x < pg.surfaceLeft || pg.x > pg.surfaceRight)) {
                        pg.state = 'falling'; pg.rollAngle = 0;
                    }
                    if (!onCard) {
                        if (pg.x > canvas.width + 20) pg.x = -15;
                        if (pg.x < -20) pg.x = canvas.width + 15;
                    }
                    break;
                }

                case 'belly-slide': {
                    pg.bellyTimer++;
                    pg.x += pg.speed * pg.direction;
                    pg.speed *= 0.9993; // very slow friction = slides much further

                    if (pg.speed < 0.08 || pg.bellyTimer > 600) {
                        pg.state = 'idle';
                        pg.idleTimer = 0;
                        pg.idleDuration = 40;
                        pg.speed = Math.random() * 0.2 + 0.15;
                    }

                    const onCard = pg.surfaceRight - pg.surfaceLeft < canvas.width - 10;
                    if (onCard && (pg.x < pg.surfaceLeft || pg.x > pg.surfaceRight)) {
                        pg.state = 'falling';
                    }
                    // Wrap
                    if (!onCard) {
                        if (pg.x > canvas.width + 20) pg.x = -15;
                        if (pg.x < -20) pg.x = canvas.width + 15;
                    }
                    break;
                }

                case 'waiting-hole': {
                    // Wait for hole to fully open, then turn back
                    if (pg.holeRef && pg.holeRef.openProgress >= 1) {
                        pg.state = 'turning-back';
                        pg.turnTimer = 0;
                    }
                    break;
                }

                case 'turning-back': {
                    // Brief pause while penguin turns around (shows back view)
                    pg.turnTimer++;
                    if (pg.turnTimer >= 25) {
                        pg.state = 'entering-hole';
                    }
                    break;
                }

                case 'entering-hole': {
                    // Shrink into the hole
                    pg.holeScale *= 0.96;
                    // Slight downward movement as if sinking
                    pg.landedY += 0.15;

                    if (pg.holeScale < 0.08) {
                        // Penguin is gone, close the hole
                        if (pg.holeRef) {
                            pg.holeRef.state = 'closing';
                        }
                        pg.state = 'dead';
                    }
                    break;
                }
            }
        }

        function drawPenguin(pg) {
            if (pg.state === 'dead') return;
            switch (pg.state) {
                case 'falling':
                    drawPenguinFalling(pg);
                    break;
                case 'rolling':
                    drawPenguinRolling(pg);
                    break;
                case 'belly-slide':
                    drawPenguinBelly(pg);
                    break;
                case 'waiting-hole':
                    // Still facing forward, standing still
                    drawPenguinSide(pg);
                    break;
                case 'turning-back':
                case 'entering-hole':
                    // Show back view (turning away / sinking in)
                    drawPenguinBack(pg);
                    break;
                default:
                    drawPenguinSide(pg);
                    break;
            }
        }

        // ==================== MAIN LOOP ====================
        function animate() {
            ctx.clearRect(0, 0, canvas.width, canvas.height);

            drawGalaxies();

            // Particles
            const mouseRadius = 150;
            const pushForce = 3;
            for (let i = 0; i < particles.length; i++) {
                const p = particles[i];
                const dx = p.x - mouse.x;
                const dy = p.y - mouse.y;
                const dist = Math.sqrt(dx * dx + dy * dy);
                if (dist < mouseRadius && dist > 0) {
                    const force = (mouseRadius - dist) / mouseRadius;
                    const angle = Math.atan2(dy, dx);
                    p.vx += Math.cos(angle) * force * pushForce * 0.15;
                    p.vy += Math.sin(angle) * force * pushForce * 0.15;
                    p.vx += Math.cos(angle + Math.PI * 0.5) * force * 0.3;
                    p.vy += Math.sin(angle + Math.PI * 0.5) * force * 0.3;
                    p.alpha = Math.min(1, p.alpha + force * 0.1);
                }
                p.vx += (p.originX - p.x) * 0.002;
                p.vy += (p.originY - p.y) * 0.002;
                p.vx *= 0.97; p.vy *= 0.97;
                p.x += p.vx; p.y += p.vy;
                p.alpha += (0.45 - p.alpha) * 0.01;
                p.rotation += p.rotationSpeed;
                const pad = 50;
                if (p.x < -pad) { p.x = canvas.width + pad; p.originX = p.x; }
                if (p.x > canvas.width + pad) { p.x = -pad; p.originX = p.x; }
                if (p.y < -pad) { p.y = canvas.height + pad; p.originY = p.y; }
                if (p.y > canvas.height + pad) { p.y = -pad; p.originY = p.y; }
                drawParticle(p);
            }

            // Shooting stars
            shootingStarTimer++;
            if (shootingStarTimer > 1200 + Math.random() * 1200) { // Thỉnh thoảng mới bay 1 cái (20 - 40 seconds)
                shootingStarTimer = 0;
                shootingStars.push(createShootingStar());
            }
            updateShootingStars();
            drawShootingStars();

            // Update & draw dynamic holes
            updateHoles();
            for (const h of activeHoles) {
                drawHole(h);
            }

            // Spawn penguins
            spawnTimer++;
            const alivePenguins = penguins.filter(p => p.state !== 'dead').length;
            if (spawnTimer > 150 && alivePenguins < TARGET_PENGUINS) {
                spawnTimer = 0;
                penguins.push(createPenguin());
            }

            // Update & draw penguins
            for (let i = penguins.length - 1; i >= 0; i--) {
                updatePenguin(penguins[i]);
                if (penguins[i].state === 'dead') {
                    penguins.splice(i, 1);
                } else {
                    drawPenguin(penguins[i]);
                }
            }

            animId = requestAnimationFrame(animate);
        }

        // Events
        function handleMouseMove(e) { mouse.x = e.clientX; mouse.y = e.clientY; }
        function handleMouseLeave() { mouse.x = -9999; mouse.y = -9999; }
        function handleTouchMove(e) { if (e.touches.length > 0) { mouse.x = e.touches[0].clientX; mouse.y = e.touches[0].clientY; } }
        function handleTouchEnd() { mouse.x = -9999; mouse.y = -9999; }
        function handleResize() { resize(); initParticles(); penguins = []; activeHoles = []; spawnTimer = 0; }

        resize();
        initParticles();
        for (let i = 0; i < 3; i++) {
            const p = createPenguin();
            p.y = -30 - Math.random() * 150;
            penguins.push(p);
        }
        animate();

        window.addEventListener('mousemove', handleMouseMove);
        window.addEventListener('mouseleave', handleMouseLeave);
        window.addEventListener('touchmove', handleTouchMove);
        window.addEventListener('touchend', handleTouchEnd);
        window.addEventListener('resize', handleResize);
        return () => {
            cancelAnimationFrame(animId);
            window.removeEventListener('mousemove', handleMouseMove);
            window.removeEventListener('mouseleave', handleMouseLeave);
            window.removeEventListener('touchmove', handleTouchMove);
            window.removeEventListener('touchend', handleTouchEnd);
            window.removeEventListener('resize', handleResize);
        };
    }, []);

    return (
        <canvas
            ref={canvasRef}
            style={{
                position: 'fixed',
                inset: 0,
                width: '100%',
                height: '100%',
                pointerEvents: 'none',
                zIndex: 0,
            }}
        />
    );
}
