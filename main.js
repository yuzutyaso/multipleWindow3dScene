import WindowManager from './WindowManager.js'

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

// タッチイベント関連の変数
let isDragging = false;
let lastPointerX, lastPointerY;
let touchStartX, touchStartY; // Initial touch position for single touch
let initialSceneOffsetX, initialSceneOffsetY; // Initial scene offset when touch starts

// get time in seconds since beginning of the day (so that all windows use the same time)
function getTime ()
{
	return (new Date().getTime() - today) / 1000.0;
}


if (new URLSearchParams(window.location.search).get("clear"))
{
	localStorage.clear();
}
else
{	
	document.addEventListener("visibilitychange", () => 
	{
		if (document.visibilityState != 'hidden' && !initialized)
		{
			init();
		}
	});

	window.onload = () => {
		if (document.visibilityState != 'hidden')
		{
			init();
		}
	};

	function init ()
	{
		initialized = true;

		setTimeout(() => {
			setupScene();
			setupWindowManager();
			resize();
			// スマートフォンではwindow.screenX/Yに依存しないため、updateWindowShapeの初期呼び出しは不要か、別のロジックが必要
            // または、タッチイベントなどでsceneOffsetTargetを更新するようにする
			// updateWindowShape(false); // この行は削除または変更
			render();
			window.addEventListener('resize', resize);

            // タッチイベントリスナーを追加
            renderer.domElement.addEventListener('touchstart', onPointerStart, { passive: false });
            renderer.domElement.addEventListener('touchmove', onPointerMove, { passive: false });
            renderer.domElement.addEventListener('touchend', onPointerEnd);
            renderer.domElement.addEventListener('mousedown', onPointerStart, { passive: false }); // デスクトップ互換性のため
            renderer.domElement.addEventListener('mousemove', onPointerMove, { passive: false });
            renderer.domElement.addEventListener('mouseup', onPointerEnd);
		}, 500)	
	}

    // ポインタイベントのハンドラ (タッチとマウスの両方に対応)
    function onPointerStart(event) {
        // 多点タッチを考慮するなら 'touches' プロパティを使用
        const clientX = event.type.startsWith('touch') ? event.touches[0].clientX : event.clientX;
        const clientY = event.type.startsWith('touch') ? event.touches[0].clientY : event.clientY;

        isDragging = true;
        lastPointerX = clientX;
        lastPointerY = clientY;
        initialSceneOffsetX = sceneOffset.x;
        initialSceneOffsetY = sceneOffset.y;
    }

    function onPointerMove(event) {
        if (!isDragging) return;

        // イベントのデフォルト動作をキャンセルしてスクロールを防ぐ
        event.preventDefault();

        const clientX = event.type.startsWith('touch') ? event.touches[0].clientX : event.clientX;
        const clientY = event.type.startsWith('touch') ? event.touches[0].clientY : event.clientY;

        const deltaX = clientX - lastPointerX;
        const deltaY = clientY - lastPointerY;

        // シーンオフセットのターゲットを、ドラッグ量に基づいて更新
        // ここでは直接オフセットを更新するシンプルな方法
        sceneOffsetTarget.x = initialSceneOffsetX + deltaX;
        sceneOffsetTarget.y = initialSceneOffsetY + deltaY;

        // もしドラッグに応じて動的にオブジェクトを配置するなら、ここで wins[i].shape.x,y を更新するなど
        // あるいは、world.position を直接操作する
    }

    function onPointerEnd() {
        isDragging = false;
    }


	function setupScene ()
	{
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

	function setupWindowManager ()
	{
		windowManager = new WindowManager();
		// スマートフォンではこのコールバックの動作を調整する必要がある
		// updateWindowShapeはwindow.screenX/Yに依存しているため、そのロジックを見直す
		windowManager.setWinShapeChangeCallback(updateWindowShape); 
		windowManager.setWinChangeCallback(windowsUpdated);

		let metaData = {foo: "bar"};

		windowManager.init(metaData);

		windowsUpdated();
	}

	function windowsUpdated ()
	{
		updateNumberOfCubes();
	}

	function updateNumberOfCubes ()
	{
		let wins = windowManager.getWindows();

		cubes.forEach((c) => {
			world.remove(c);
		})

		cubes = [];

		for (let i = 0; i < wins.length; i++)
		{
			let win = wins[i];

			let c = new t.Color();
			c.setHSL(i * .1, 1.0, .5);

			let s = 100 + i * 50;
			let cube = new t.Mesh(new t.BoxGeometry(s, s, s), new t.MeshBasicMaterial({color: c , wireframe: true}));
			
            // キューブの初期位置は、ウィンドウの相対位置ではなく、
            // 画面の中央からのオフセットや、タッチでの移動を考慮した位置に設定する
            // ここでは簡易的に、各キューブが横に並ぶように配置
            cube.position.x = (i * s * 1.5) - (wins.length * s * 1.5 * 0.5); // 画面中央に配置
            cube.position.y = 0; // 画面中央に配置

			world.add(cube);
			cubes.push(cube);
		}
	}

    // スマートフォンではこの関数はwindow.screenX/Yに依存しないように変更が必要
    // タッチイベントやジェスチャーでsceneOffsetTargetが直接更新されることを想定
	function updateWindowShape (easing = true)
	{
		// sceneOffsetTarget = {x: -window.screenX, y: -window.screenY}; // この行はモバイルでは機能しないため削除または変更
		// モバイルでは、ユーザーのドラッグ操作によってsceneOffsetTargetが更新される
        // または、特定の固定位置にシーンを配置する
        // 例： sceneOffsetTarget = {x: 0, y: 0};
        // あるいは、現在のシーンの中心に固定
        if (!easing) sceneOffset = sceneOffsetTarget;
	}


	function render ()
	{
		let t = getTime();

		// windowManager.update(); // これはデスクトップの複数ウィンドウ同期ロジック

		let falloff = .05;
		sceneOffset.x = sceneOffset.x + ((sceneOffsetTarget.x - sceneOffset.x) * falloff);
		sceneOffset.y = sceneOffset.y + ((sceneOffsetTarget.y - sceneOffset.y) * falloff);

		// set the world position to the offset
		world.position.x = sceneOffset.x;
		world.position.y = sceneOffset.y;

		let wins = windowManager.getWindows(); // ここで取得される wins の内容は、モバイルでは「複数のウィンドウ」ではなく、
                                              // WindowManagerが管理する「複数の要素」として解釈されるべき

		for (let i = 0; i < cubes.length; i++)
		{
			let cube = cubes[i];
			let win = wins[i];
			let _t = t;// + i * .2;

            // キューブの移動ロジックは、ウィンドウの位置に依存しないように変更
            // 例：固定された位置から回転、またはタッチ操作に応じて移動
            // posTargetは、ここではキューブの初期相対位置として機能する
			// let posTarget = {x: win.shape.x + (win.shape.w * .5), y: win.shape.y + (win.shape.h * .5)} // この行は変更

            // スマートフォンでは、各キューブは単一のキャンバス内で相対的に動く
            // ここではワールド空間でキューブが回転するようにする
            cube.rotation.x = _t * .5;
			cube.rotation.y = _t * .3;
            // cube.position.x, cube.position.y は updateNumberOfCubes で設定された相対位置を維持
		};

		renderer.render(scene, camera);
		requestAnimationFrame(render);
	}


	function resize ()
	{
		let width = window.innerWidth;
		let height = window.innerHeight
		
		camera = new t.OrthographicCamera(0, width, 0, height, -10000, 10000);
		camera.updateProjectionMatrix();
		renderer.setSize( width, height );
	}
}
