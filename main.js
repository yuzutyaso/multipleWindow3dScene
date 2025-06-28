import WindowManager from './WindowManager.js';

const t = THREE;
let camera, scene, renderer, world;
let near, far;
let pixR = window.devicePixelRatio ? window.devicePixelRatio : 1;
let cubes = [];
let sceneOffsetTarget = {x: 0, y: 0};
let sceneOffset = {x: 0, y: 0};

let today = new Date();
today.setHours(0);
today.setMinutes(0);
today.setSeconds(0);
today.setMilliseconds(0);
today = today.getTime();

let internalTime = getTime();
let windowManager;
let initialized = false;

// --- スマートフォン対応のための追加・変更箇所 ---
let isDragging = false;
let lastPointerX, lastPointerY;
let initialSceneOffsetX, initialSceneOffsetY; // タッチ開始時のシーンオフセット

// 時間取得関数はそのまま
function getTime () {
	return (new Date().getTime() - today) / 1000.0;
}

if (new URLSearchParams(window.location.search).get("clear")) {
	localStorage.clear();
} else {	
	document.addEventListener("visibilitychange", () => {
		if (document.visibilityState != 'hidden' && !initialized) {
			init();
		}
	});

	window.onload = () => {
		if (document.visibilityState != 'hidden') {
			init();
		}
	};

	function init () {
		initialized = true;

		setTimeout(() => {
			setupScene();
			setupWindowManager();
			resize();
			// スマートフォンでは window.screenX/Y に依存しないため、
			// updateWindowShape の初期呼び出しは不要か、別のロジックが必要です
			// updateWindowShape(false); // この行は削除または変更が必要です

			// --- タッチイベントリスナーの追加 ---
            // renderer.domElement にイベントリスナーを追加することで、キャンバス上での操作を検出
            renderer.domElement.addEventListener('touchstart', onPointerStart, { passive: false });
            renderer.domElement.addEventListener('touchmove', onPointerMove, { passive: false });
            renderer.domElement.addEventListener('touchend', onPointerEnd);
            // マウスイベントも残しておくとデスクトップでのデバッグに便利
            renderer.domElement.addEventListener('mousedown', onPointerStart, { passive: false });
            renderer.domElement.addEventListener('mousemove', onPointerMove, { passive: false });
            renderer.domElement.addEventListener('mouseup', onPointerEnd);

			render();
			window.addEventListener('resize', resize);
		}, 500);	
	}

    // --- ポインターイベントのハンドラ (タッチとマウスの両方に対応) ---
    function onPointerStart(event) {
        // タッチイベントの場合は最初の指、マウスイベントの場合はそのままの座標を使用
        const clientX = event.type.startsWith('touch') ? event.touches[0].clientX : event.clientX;
        const clientY = event.type.startsWith('touch') ? event.touches[0].clientY : event.clientY;

        isDragging = true;
        lastPointerX = clientX;
        lastPointerY = clientY;
        // ドラッグ開始時のシーンオフセットを記録
        initialSceneOffsetX = sceneOffset.x;
        initialSceneOffsetY = sceneOffset.y;
    }

    function onPointerMove(event) {
        if (!isDragging) return;

        // スクロールなどのデフォルト動作を防ぐ
        event.preventDefault();

        const clientX = event.type.startsWith('touch') ? event.touches[0].clientX : event.clientX;
        const clientY = event.type.startsWith('touch') ? event.touches[0].clientY : event.clientY;

        const deltaX = clientX - lastPointerX;
        const deltaY = clientY - lastPointerY;

        // 指の移動量に基づいてシーンオフセットのターゲットを更新
        // ここではドラッグに合わせてシーンが直接移動するようにしています
        sceneOffsetTarget.x = initialSceneOffsetX + deltaX;
        sceneOffsetTarget.y = initialSceneOffsetY + deltaY;

        // lastPointerX = clientX; // 継続的なドラッグのために最終座標を更新
        // lastPointerY = clientY;
    }

    function onPointerEnd() {
        isDragging = false;
    }
    // ----------------------------------------------------

	function setupScene () {
		camera = new t.OrthographicCamera(0, 0, window.innerWidth, window.innerHeight, -10000, 10000);
		
		camera.position.z = 2.5;
		near = camera.position.z - .5;
		far = camera.position.z + 0.5;

		scene = new t.Scene();
		scene.background = new t.Color(0.0);
		scene.add( camera );

		renderer = new t.WebGLRenderer({antialias: true, depthBuffer: true});
		renderer.setPixelRatio(pixR);
	    
	  	world = new t.Object3D();
		scene.add(world);

		renderer.domElement.setAttribute("id", "scene");
		document.body.appendChild( renderer.domElement );
	}

	function setupWindowManager () {
		windowManager = new WindowManager();
		// スマートフォンでは updateWindowShape の役割が変わるため、このコールバックは残しつつ、
		// 内部ロジックをモバイル向けに調整する必要がある
		windowManager.setWinShapeChangeCallback(updateWindowShape);
		windowManager.setWinChangeCallback(windowsUpdated);

		let metaData = {foo: "bar"};

		windowManager.init(metaData);

		windowsUpdated();
	}

	function windowsUpdated () {
		updateNumberOfCubes();
	}

	function updateNumberOfCubes () {
		let wins = windowManager.getWindows();

		cubes.forEach((c) => {
			world.remove(c);
		});

		cubes = [];

		for (let i = 0; i < wins.length; i++) {
			let win = wins[i]; // ここでの 'win' は、もはやブラウザウィンドウではなく、WindowManagerが管理する「データオブジェクト」
                               // と解釈する必要があります。

			let c = new t.Color();
			c.setHSL(i * .1, 1.0, .5);

			let s = 100 + i * 50;
			let cube = new t.Mesh(new t.BoxGeometry(s, s, s), new t.MeshBasicMaterial({color: c , wireframe: true}));
			
            // --- キューブの初期配置を画面中央を基準に調整 ---
            // win.shape.x, win.shape.y はデスクトップのウィンドウ位置なので、
            // スマートフォンでは画面内の相対位置として再定義
            cube.position.x = (i * s * 1.5) - (wins.length * s * 1.5 * 0.5); // 横に並べる例
            cube.position.y = 0; // 画面中央のY座標

			world.add(cube);
			cubes.push(cube);
		}
	}

	// --- updateWindowShape関数の修正 ---
    // スマートフォンでは window.screenX/Y は機能しないため、この関数は別の目的で使用するか、
    // ここでsceneOffsetTargetを直接更新するロジックは削除します。
    // 代わりに、タッチイベントが sceneOffsetTarget を更新します。
	function updateWindowShape (easing = true) {
		// sceneOffsetTarget = {x: -window.screenX, y: -window.screenY}; // この行は削除または変更
		// もし easing が false の場合にシーンオフセットを瞬時に更新したい場合は、別のロジックを追加
        if (!easing) {
            // 例: シーンを中央に戻す
            // sceneOffset.x = 0;
            // sceneOffset.y = 0;
            // sceneOffsetTarget.x = 0;
            // sceneOffsetTarget.y = 0;
        }
	}


	function render () {
		let t = getTime();

		// windowManager.update(); // これはデスクトップの複数ウィンドウ同期ロジック

		let falloff = .05;
		sceneOffset.x = sceneOffset.x + ((sceneOffsetTarget.x - sceneOffset.x) * falloff);
		sceneOffset.y = sceneOffset.y + ((sceneOffsetTarget.y - sceneOffset.y) * falloff);

		// set the world position to the offset
		world.position.x = sceneOffset.x;
		world.position.y = sceneOffset.y;

		let wins = windowManager.getWindows(); // ここで得られる 'wins' はキューブのデータとして利用

		for (let i = 0; i < cubes.length; i++) {
			let cube = cubes[i];
			let win = wins[i]; // 各キューブに対応するデータ

			// --- キューブの移動ロジックも調整 ---
			// win.shape.x や win.shape.y に依存するのではなく、
			// キューブ自体の回転や、タッチ操作によるシーン全体の移動で表現します。
			// posTarget はもはやウィンドウ位置ではないため、削除または別の用途に。
			
			cube.rotation.x = t * .5;
			cube.rotation.y = t * .3;
		}

		renderer.render(scene, camera);
		requestAnimationFrame(render);
	}

	function resize () {
		let width = window.innerWidth;
		let height = window.innerHeight;
		
		camera = new t.OrthographicCamera(0, width, 0, height, -10000, 10000);
		camera.updateProjectionMatrix();
		renderer.setSize( width, height );
	}
}
