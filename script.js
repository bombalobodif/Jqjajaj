let logMessages = [];
let globalMenu = null;

function log(message) {
    if (globalMenu) globalMenu.log(message);
}

function getClassLoader() {
    return {
        Gravity: Java.use("android.view.Gravity"),
        TextView: Java.use("android.widget.TextView"),
        LinearLayout: Java.use("android.widget.LinearLayout"),
        LinearLayout_LayoutParams: Java.use("android.widget.LinearLayout$LayoutParams"),
        FrameLayout: Java.use("android.widget.FrameLayout"),
        FrameLayout_LayoutParams: Java.use("android.widget.FrameLayout$LayoutParams"),
        Color: Java.use("android.graphics.Color"),
        ActivityThread: Java.use("android.app.ActivityThread"),
        ActivityThread_ActivityClientRecord: Java.use("android.app.ActivityThread$ActivityClientRecord"),
        View_OnTouchListener: Java.use("android.view.View$OnTouchListener"),
        View_OnClickListener: Java.use("android.view.View$OnClickListener"),
        MotionEvent: Java.use("android.view.MotionEvent"),
        String: Java.use("java.lang.String"),
        ScrollView: Java.use("android.widget.ScrollView"),
        Button: Java.use("android.widget.Button"),
        GradientDrawable: Java.use("android.graphics.drawable.GradientDrawable"),
    };
}

function dp(context, value) {
    return parseInt(value * context.getResources().getDisplayMetrics().density.value);
}

function getMainActivity(cl) {
    const thread = cl.ActivityThread.sCurrentActivityThread.value;
    const record = Java.cast(thread.mActivities.value.valueAt(0), cl.ActivityThread_ActivityClientRecord);
    return record.activity.value;
}

function makeRoundedDrawable(cl, colorHex, radiusDp, activity) {
    const drawable = cl.GradientDrawable.$new();
    drawable.setShape(cl.GradientDrawable.RECTANGLE.value);
    drawable.setColor(cl.Color.parseColor(colorHex));
    drawable.setCornerRadius(dp(activity, radiusDp));
    return drawable;
}

class Menu {
    #cl; #activity; #MATCH; #WRAP;
    #contentView; #mainLayout; #menuLayout; #scrollLayout;
    #isOpen = false; #openBtn; #colorOn; #colorOff;
    #logOverlay; #logTextView; #logScrollView;

    constructor(cl, activity) {
        this.#cl = cl;
        this.#activity = activity;
        this.#MATCH = cl.LinearLayout_LayoutParams.MATCH_PARENT.value;
        this.#WRAP = cl.LinearLayout_LayoutParams.WRAP_CONTENT.value;
        this.#build();
    }

    #build() {
        // Fullscreen overlay
        this.#contentView = this.#cl.FrameLayout.$new(this.#activity);
        const fp = this.#cl.FrameLayout_LayoutParams.$new(this.#MATCH, this.#MATCH);
        this.#contentView.setLayoutParams(fp);
        this.#contentView.setBackgroundColor(this.#cl.Color.TRANSPARENT.value);

        // Floating container
        this.#mainLayout = this.#cl.LinearLayout.$new(this.#activity);
        this.#mainLayout.setOrientation(this.#mainLayout.VERTICAL.value);
        const mainFrame = this.#cl.FrameLayout_LayoutParams.$new(this.#WRAP, this.#WRAP);
        mainFrame.gravity = this.#cl.Gravity.TOP.value | this.#cl.Gravity.START.value;
        mainFrame.setMargins(dp(this.#activity, 16), dp(this.#activity, 60), 0, 0);
        this.#mainLayout.setLayoutParams(mainFrame);

        // Open/close tlačítko
        this.#openBtn = this.#cl.Button.$new(this.#activity);
        const bp = this.#cl.LinearLayout_LayoutParams.$new(dp(this.#activity, 56), dp(this.#activity, 56));
        this.#openBtn.setLayoutParams(bp);
        this.#openBtn.setText(this.#cl.String.$new("☰"));
        this.#openBtn.setTextColor(this.#cl.Color.parseColor("#FFFFFF"));
        this.#openBtn.setBackground(makeRoundedDrawable(this.#cl, "#635985", 16, this.#activity));

        // Menu panel
        this.#menuLayout = this.#cl.LinearLayout.$new(this.#activity);
        const mlp = this.#cl.LinearLayout_LayoutParams.$new(dp(this.#activity, 220), this.#WRAP);
        mlp.setMargins(0, dp(this.#activity, 8), 0, 0);
        this.#menuLayout.setLayoutParams(mlp);
        this.#menuLayout.setOrientation(this.#menuLayout.VERTICAL.value);
        this.#menuLayout.setBackground(makeRoundedDrawable(this.#cl, "#18122B", 20, this.#activity));
        const pad = dp(this.#activity, 12);
        this.#menuLayout.setPadding(pad, pad, pad, pad);
        this.#menuLayout.setVisibility(0x8);

        // ScrollView uvnitř menu
        const scroll = this.#cl.ScrollView.$new(this.#activity);
        scroll.setLayoutParams(this.#cl.LinearLayout_LayoutParams.$new(this.#MATCH, this.#WRAP));
        this.#scrollLayout = this.#cl.LinearLayout.$new(this.#activity);
        this.#scrollLayout.setLayoutParams(this.#cl.LinearLayout_LayoutParams.$new(this.#MATCH, this.#WRAP));
        this.#scrollLayout.setOrientation(this.#scrollLayout.VERTICAL.value);
        scroll.addView(this.#scrollLayout);
        this.#menuLayout.addView(scroll);

        // Toggle menu
        const that = this;
        const ToggleListener = Java.registerClass({
            name: "com.example.MenuToggle",
            implements: [this.#cl.View_OnClickListener],
            methods: {
                onClick(v) {
                    that.#isOpen = !that.#isOpen;
                    that.#menuLayout.setVisibility(that.#isOpen ? 0x0 : 0x8);
                }
            }
        });
        this.#openBtn.setOnClickListener(ToggleListener.$new());

        this.#addDrag();
        this.#buildLogOverlay();
    }

    #buildLogOverlay() {
        const cl = this.#cl;
        const activity = this.#activity;

        // Poloprůhledné pozadí
        this.#logOverlay = cl.FrameLayout.$new(activity);
        const olp = cl.FrameLayout_LayoutParams.$new(this.#MATCH, this.#MATCH);
        this.#logOverlay.setLayoutParams(olp);
        this.#logOverlay.setBackgroundColor(cl.Color.parseColor("#AA000000"));
        this.#logOverlay.setVisibility(0x8);

        // Karta logu
        const card = cl.LinearLayout.$new(activity);
        const clp = cl.FrameLayout_LayoutParams.$new(dp(activity, 320), dp(activity, 420));
        clp.gravity = cl.Gravity.CENTER.value;
        card.setLayoutParams(clp);
        card.setOrientation(card.VERTICAL.value);
        card.setBackground(makeRoundedDrawable(cl, "#18122B", 24, activity));
        const cp = dp(activity, 16);
        card.setPadding(cp, cp, cp, cp);

        // Nadpis
        const title = cl.TextView.$new(activity);
        const titleLp = cl.LinearLayout_LayoutParams.$new(this.#MATCH, this.#WRAP);
        titleLp.setMargins(0, 0, 0, dp(activity, 12));
        title.setLayoutParams(titleLp);
        title.setText(cl.String.$new("📋  Log"));
        title.setTextColor(cl.Color.parseColor("#FFC107"));
        title.setTextSize(18);
        title.setGravity(cl.Gravity.CENTER.value);

        // ScrollView pro logy
        this.#logScrollView = cl.ScrollView.$new(activity);
        //const slp = cl.LinearLayout_LayoutParams.$new(this.#MATCH, 0);
        //slp.weight = 1;

        const slp = cl.LinearLayout_LayoutParams.$new(this.#MATCH, dp(activity, 260));
        this.#logScrollView.setLayoutParams(slp);
        
        this.#logScrollView.setLayoutParams(slp);
        this.#logScrollView.setBackground(makeRoundedDrawable(cl, "#0D0A1A", 16, activity));
        const sp = dp(activity, 10);
        this.#logScrollView.setPadding(sp, sp, sp, sp);

        //this.#logTextView = cl.TextView.$new(activity);
        //this.#logTextView.setLayoutParams(cl.LinearLayout_LayoutParams.$new(this.#MATCH, this.#WRAP));
        this.#logTextView = cl.TextView.$new(activity);
        const tvLp = cl.LinearLayout_LayoutParams.$new(this.#MATCH, this.#MATCH);
        this.#logTextView.setLayoutParams(tvLp);
        this.#logTextView.setMinHeight(dp(activity, 200));
        
        this.#logTextView.setTextColor(cl.Color.parseColor("#AAFFAA"));
        this.#logTextView.setTextSize(13);
        this.#logScrollView.addView(this.#logTextView);

        // Zavírací tlačítko
        const closeBtn = cl.Button.$new(activity);
        const cbp = cl.LinearLayout_LayoutParams.$new(this.#MATCH, this.#WRAP);
        cbp.setMargins(0, dp(activity, 12), 0, 0);
        closeBtn.setLayoutParams(cbp);
        closeBtn.setText(cl.String.$new("✕  Zavřít"));
        closeBtn.setTextColor(cl.Color.parseColor("#FFFFFF"));
        closeBtn.setBackground(makeRoundedDrawable(cl, "#635985", 14, activity));

        const that = this;
        const CloseListener = Java.registerClass({
            name: "com.example.LogClose",
            implements: [cl.View_OnClickListener],
            methods: {
                onClick(v) {
                    that.#logOverlay.setVisibility(0x8);
                }
            }
        });
        closeBtn.setOnClickListener(CloseListener.$new());

        card.addView(title);
        card.addView(this.#logScrollView);
        card.addView(closeBtn);
        this.#logOverlay.addView(card);
    }

    #addDrag() {
        const cl = this.#cl;
        let ix = 0, iy = 0, t0 = 0;

        const DragListener = Java.registerClass({
            name: "com.example.MenuDrag",
            implements: [cl.View_OnTouchListener],
            methods: {
                onTouch(view, event) {
                    switch (event.getAction()) {
                        case cl.MotionEvent.ACTION_DOWN.value:
                            ix = view.getX() - event.getRawX();
                            iy = view.getY() - event.getRawY();
                            t0 = Date.now();
                            break;
                        case cl.MotionEvent.ACTION_MOVE.value:
                            if (Date.now() - t0 > 150) {
                                view.setX(event.getRawX() + ix);
                                view.setY(event.getRawY() + iy);
                            }
                            break;
                    }
                    return false;
                }
            }
        });
        this.#mainLayout.setOnTouchListener(DragListener.$new());
    }

    setColors(colorOn, colorOff) {
        this.#colorOn = colorOn;
        this.#colorOff = colorOff;
    }

    addButton(id, label, callbacks, defaultOn = false) {
        const cl = this.#cl;
        const activity = this.#activity;
        const colorOn = this.#colorOn;
        const colorOff = this.#colorOff;

        const btn = cl.Button.$new(activity);
        const lp = cl.LinearLayout_LayoutParams.$new(this.#MATCH, this.#WRAP);
        lp.setMargins(0, 0, 0, dp(activity, 8));
        btn.setLayoutParams(lp);
        btn.setText(cl.String.$new(label));
        btn.setTextColor(cl.Color.parseColor("#FFFFFF"));

        let state = defaultOn;
        btn.setBackground(makeRoundedDrawable(cl, state ? colorOn : colorOff, 12, activity));
        if (defaultOn) callbacks.on();

        const ClickListener = Java.registerClass({
            name: "com.example.BtnClick" + id,
            implements: [cl.View_OnClickListener],
            methods: {
                onClick(v) {
                    state = !state;
                    v.setBackground(makeRoundedDrawable(cl, state ? colorOn : colorOff, 12, activity));
                    state ? callbacks.on() : callbacks.off();
                }
            }
        });
        btn.setOnClickListener(ClickListener.$new());
        this.#scrollLayout.addView(btn);
    }

    addLogButton() {
        const cl = this.#cl;
        const activity = this.#activity;

        const btn = cl.Button.$new(activity);
        const lp = cl.LinearLayout_LayoutParams.$new(this.#MATCH, this.#WRAP);
        lp.setMargins(0, 0, 0, dp(activity, 8));
        btn.setLayoutParams(lp);
        btn.setText(cl.String.$new("📋  Log"));
        btn.setTextColor(cl.Color.parseColor("#FFFFFF"));
        btn.setBackground(makeRoundedDrawable(cl, "#2E2A4A", 12, activity));

        const that = this;
        const OpenLog = Java.registerClass({
            name: "com.example.OpenLog",
            implements: [cl.View_OnClickListener],
            methods: {
                onClick(v) {
                    that.#logOverlay.setVisibility(0x0);
                    that.updateLogView();
                }
            }
        });
        btn.setOnClickListener(OpenLog.$new());
        this.#scrollLayout.addView(btn);
    }

    log(message) {
        const timestamp = new Date().toLocaleTimeString();
        logMessages.push(`[${timestamp}] ${message}`);

        const MAX_LOG_MESSAGES = 20;
        if (logMessages.length > MAX_LOG_MESSAGES) {
            logMessages.splice(0, logMessages.length - MAX_LOG_MESSAGES);
        }
        
        const tv = this.#logTextView;
        const cl = this.#cl;
        if (!tv) return;
        Java.scheduleOnMainThread(() => {
            try {
                const text = logMessages.join('\n');
                tv.setText(cl.String.$new(text));
                const sv = this.#logScrollView;
                if (sv) sv.fullScroll(0x00000082);
            } catch(e) {}
        });
    }

    logaas(message) {
        const timestamp = new Date().toLocaleTimeString();
        logMessages.push(`[${timestamp}] ${message}`);
        Java.scheduleOnMainThread(() => {
            this.updateLogView();
        });
    }

    updateLogView() {
        if (!this.#logTextView) return;
        const tv = this.#logTextView;
        const cl = this.#cl;
        const sv = this.#logScrollView;
        const text = logMessages.length > 0 ? logMessages.join('\n') : "(žádné logy)";
        tv.setText(cl.String.$new(text));
        if (sv) sv.fullScroll(0x00000082);
    }

    start() {
        this.#activity.addContentView(this.#contentView, this.#contentView.getLayoutParams());
        this.#contentView.addView(this.#mainLayout);
        this.#contentView.addView(this.#logOverlay);
        this.#mainLayout.addView(this.#openBtn);
        this.#mainLayout.addView(this.#menuLayout);
    }
}

const base = Module.findBaseAddress("libg.so");
const malloc = new NativeFunction(Module.getExportByName("libc.so", "malloc"), "pointer", ["uint"]);

let state = {
    aimbot: false,
    dodge: false,
    ghost: false,
    name: false,
    joystick: false,
    spinner: false,
    autododge: false
}

const OFFSETS = {
    LogicBattleModeClient_update: 0xB1E934,
    BattleMode_getInstance: 0x906734,
    LogicGameObjectClient_getX: 0xA7C8EC,
    LogicGameObjectClient_getY: 0xA7C8F4,
    LogicBattleModeClient_getOwnCharacter: 0xB2047C,
    ClientInput_type_offset: 4,
    BattleScreen_getClosestTargetForAutoshoot: 0x7C7778,
    BattleScreen_activateSkill: 0x7B6C90,
    Gui_getInstance: 0x573ED0,
    StringCtor: 0xD525A0,
    Gui_showFloaterTextAtDefaultPos: 0x7CB220,
    LogicBattleModeClient_getOwnPlayerTeam: 0xB200D4,
    LogicGameObjectClient_getGlobalID: 0xA7C898,
    LogicGameObjectClient_getData: 0xA7C61C,
    LogicProjectileData_getRadius: 0xA204FC,
    LogicProjectileData_getSpeed: 0xA2047C,
    VTABLE_PROJECTILE_DATA: 0x10C36F8,
    LogicCharacterData_getCollisionRadius: 0x9DC700,
    ClientInputManager_addInput: 0x752564,
    ClientInput_constructor_int: 0xAE44EC,
    ignoresCollisions: 0xA4EACC,
    tileBasedRaycast: 0xB61FB0,
    showEmote: 0x552138,
    showSpray: 0x5521C4,
    characterVTABLE: 0x106C968,
    myDeathVTABLE: 0x10C1CA0,
    decoratedTextFieldSetPlayerName: 0x570A54,
    decoratedTextFieldSetupPlayerNameText: 0x570B68,
    guiFormatPlayerName: 0x579518,
    logicTileMapUpdate: 0x981A40,
    handleJoystick: 0x7BD124
};

const natives = {
    BattleMode_getInstance: new NativeFunction(base.add(OFFSETS.BattleMode_getInstance), "pointer", []),
    LogicGameObjectClient_getX: new NativeFunction(base.add(OFFSETS.LogicGameObjectClient_getX), "uint32", ["pointer"]),
    LogicGameObjectClient_getY: new NativeFunction(base.add(OFFSETS.LogicGameObjectClient_getY), "uint32", ["pointer"]),
    LogicBattleModeClient_getOwnCharacter: new NativeFunction(base.add(OFFSETS.LogicBattleModeClient_getOwnCharacter), "pointer", ["pointer"]),
    Gui_getInstance: new NativeFunction(base.add(OFFSETS.Gui_getInstance), "pointer", []),
    StringCtor: new NativeFunction(base.add(OFFSETS.StringCtor), "pointer", ["pointer", "pointer"]),
    Gui_showFloaterTextAtDefaultPos: new NativeFunction(base.add(OFFSETS.Gui_showFloaterTextAtDefaultPos), "void", ["pointer", "pointer", "int", "int"]),
    LogicGameObjectClient_getGlobalID: new NativeFunction(base.add(OFFSETS.LogicGameObjectClient_getGlobalID), "uint32", ["pointer"]),
    LogicBattleModeClient_getOwnCharacter: new NativeFunction(base.add(OFFSETS.LogicBattleModeClient_getOwnCharacter), "pointer", ["pointer"]),
    LogicBattleModeClient_getOwnPlayerTeam: new NativeFunction(base.add(OFFSETS.LogicBattleModeClient_getOwnPlayerTeam), "uint32", ["pointer"]),
    LogicGameObjectClient_getData: new NativeFunction(base.add(OFFSETS.LogicGameObjectClient_getData), "pointer", ["pointer"]),
    LogicProjectileData_getSpeed: new NativeFunction(base.add(OFFSETS.LogicProjectileData_getSpeed), "uint32", ["pointer"]),
    LogicProjectileData_getRadius: new NativeFunction(base.add(OFFSETS.LogicProjectileData_getRadius), "uint32", ["pointer"]),
    LogicCharacterData_getCollisionRadius: new NativeFunction(base.add(OFFSETS.LogicCharacterData_getCollisionRadius), "uint32", ["pointer"]),
    ClientInput_constructor_int: new NativeFunction(base.add(OFFSETS.ClientInput_constructor_int), "pointer", ["pointer", "int"]),
    ClientInputManager_addInput: new NativeFunction(base.add(OFFSETS.ClientInputManager_addInput), "void", ["pointer", "pointer"]),
    showSpray: new NativeFunction(base.add(OFFSETS.showSpray), 'void', ['uint32']),
    showEmote: new NativeFunction(base.add(OFFSETS.showEmote), 'void', ['uint32'])
};

//CONFIG
const config = {
    lastpositionsLen: 3,
    projectileSpeed: 3255,
    useWeightedAverage: false,
    timeToHitMultiplyCoeficient: 0.8
};
//CONFIG

//AIMBOT
const getinstance = natives.Gui_getInstance;
const stringctor = natives.StringCtor;
const floater = natives.Gui_showFloaterTextAtDefaultPos;

const latestX = createRecentArray(config.lastpositionsLen);
const latestY = createRecentArray(config.lastpositionsLen);
const timeDiffs = createRecentArray(config.lastpositionsLen - 1);
let battleMode = null;
let lastTime = 0;

function createRecentArray(max = 2) {
    const arr = [];
    return {
        array: arr,
        push: val => {
            arr.push(val);
            if (arr.length > max) arr.shift();
        },
        setMax: newMax => {
            max = newMax;
            while (arr.length > max) arr.shift();
        }
    };
}

function predictFuturePosition(timeToPredictSeconds) {
    if (latestX.array.length < 2 || timeDiffs.array.length < 1) {
        return { x: latestX.array[latestX.array.length - 1] || 0, y: latestY.array[latestY.array.length - 1] || 0 };
    }

    const totalTimeDiff = timeDiffs.array.reduce((sum, diff) => sum + diff, 0);
    const avgTimeDiff = totalTimeDiff / timeDiffs.array.length / 1000;

    let totalVx = 0;
    let totalVy = 0;
    let weightSum = 0;
        
    for (let i = 1; i < latestX.array.length; i++) {
        const dx = latestX.array[i] - latestX.array[i - 1];
        const dy = latestY.array[i] - latestY.array[i - 1];
        const dt = timeDiffs.array[i - 1] / 1000;
            
        if (dt <= 0) continue;
            
        const weight = i;
        totalVx += (dx / dt) * weight;
        totalVy += (dy / dt) * weight;
        weightSum += weight;
    }

    const avgVx = weightSum > 0 ? totalVx / weightSum : 0;
    const avgVy = weightSum > 0 ? totalVy / weightSum : 0;

    const currentX = latestX.array[latestX.array.length - 1];
    const currentY = latestY.array[latestY.array.length - 1];

    const predictedX = currentX + avgVx * timeToPredictSeconds;
    const predictedY = currentY + avgVy * timeToPredictSeconds;

    return { x: predictedX, y: predictedY };
}

function calculateDistance(x1, y1, x2, y2) {
    const dx = x2 - x1;
    const dy = y2 - y1;
    return Math.sqrt(dx * dx + dy * dy);
}

function calculateTimeToHit(x1, y1, x2, y2) {
    const distance = calculateDistance(x1, y1, x2, y2);
    return distance / config.projectileSpeed;
}

function getStrPtr(str) {
    return Memory.allocUtf8String(str);
}

function getScPtr(str) {
    var pointer = malloc(40);
    stringctor(pointer, getStrPtr(str)); 
    return pointer;
}

function showFloater(text) {
    floater(getinstance(), getScPtr(text), 0, -1);
}

function aimbot() {
    Interceptor.attach(base.add(OFFSETS.BattleScreen_getClosestTargetForAutoshoot), {
        onLeave: function(retval) {
            if (retval == 0x0) {
                return;
            }
            const x = natives.LogicGameObjectClient_getX(retval);
            const y = natives.LogicGameObjectClient_getY(retval);
            latestX.push(x);
            latestY.push(y);

            const now = Date.now();
            
            if (lastTime !== 0) {
                const diff = now - lastTime;
                timeDiffs.push(diff);
            }

            lastTime = now;
        }
    });

    Interceptor.attach(base.add(OFFSETS.BattleScreen_activateSkill), {
        onEnter: function(args) {
            if (!state.aimbot || !battleMode) {
                return;
            }

            let isAutoshot = (parseInt(args[6]) !== 0);
            if (!isAutoshot) {
                log("not autoshot");
                return;
            }

            try {
                const ownLogicCharacter = natives.LogicBattleModeClient_getOwnCharacter(battleMode);
                const ownX = natives.LogicGameObjectClient_getX(ownLogicCharacter);
                const ownY = natives.LogicGameObjectClient_getY(ownLogicCharacter);
                const timeToHit = config.timeToHitMultiplyCoeficient * calculateTimeToHit(
                    ownX, 
                    ownY, 
                    latestX.array[latestX.array.length - 1], 
                    latestY.array[latestY.array.length - 1]
                );
                const predictedPos = predictFuturePosition(timeToHit);

                args[5] = ptr(0);
                args[1] = ptr(Math.round(predictedPos.x));
                args[2] = ptr(Math.round(predictedPos.y));
            } catch (e) {
            }
        },
    });

    Interceptor.attach(base.add(OFFSETS.LogicBattleModeClient_update), {
        onEnter: function(args) {
            battleMode = args[0];
        }
    });

    showFloater("aimbot loaded");
}

//DODGE
const PTR_VTABLE_PROJECTILE_DATA = base.add(OFFSETS.VTABLE_PROJECTILE_DATA);
const PTR_VTABLE_CHARACTER_DATA = base.add(OFFSETS.characterVTABLE);
const PTR_VTABLE_MYDEATH_DATA = base.add(OFFSETS.myDeathVTABLE);
let inputId = 0;

const CONFIG = {
    DODGE_DISTANCE: 500,
    DODGE_COOLDOWN: 10,
    INPUT_COOLDOWN: 3,
    FORCE_DODGE_DELAY: 5,
    MOVEMENT_UPDATE_INTERVAL: 3,
    DODGE_UPDATE_MS: 3,
    FORCE_BLOCK_DURATION: 300,
    PREDICTION_TIME_MS: 100
};

let current = {
    x: 0,
    y: 0
}

let previous = {
    x: 0,
    y: 0
}

let movement = {
    previousTime: 0,
    dirX: 0,
    dirY: 0,
    speed: 0
}

const projectiles = new Map();
const characters = [];

let ownCharacter = ptr(-1);
let lastDodgeTime = 0;

let ownPlayerID = -67;

function readStringbad(strPtr) {
    var ptr_ = ptr(strPtr);
    
    var len = ptr_.add(0x4).readS32();
    
    if (len <= 7) {
        // inline - data přímo na 0x08
        return ptr_.add(0x8).readUtf8String(len);
    } else {
        // heap - na 0x08 je pointer na data
        var dataPtr = ptr_.add(0x8).readPointer();
        return dataPtr.readUtf8String(len);
    }
}

function readString(ptr) {
    const length = ptr.add(4).readS32();
    
    if (length <= 7) {
        // SSO: data jsou přímo inline na offset +8
        return ptr.add(8).readUtf8String(length);
    } else {
        // Heap: na offset +8 je pointer na skutečná data
        const dataPtr = ptr.add(8).readPointer();
        return dataPtr.readUtf8String(length);
    }
}

function readString2(ptr) {
    if (ptr.isNull()) return null;
    
    let len = ptr.add(4).readInt();
    if (len <= 0 || len > 1000) return null;  // sanity check
    
    let dataPtr;
    if (len > 7) {
        // dlouhý string → dereferencuj pointer na offset 0x08
        dataPtr = ptr.add(8).readPointer();
    } else {
        // krátký string → data jsou přímo na offset 0x08
        dataPtr = ptr.add(8);
    }
    
    if (dataPtr.isNull()) return null;
    return dataPtr.readUtf8String(len);
}

function isString(ptr) {
    try {
        // null check
        if (ptr.isNull()) return false;
        
        // magic value check - offset 0 musí být 0xffffffff
        const magic = ptr.readU32();
        if (magic !== 0xffffffff) return false;
        
        // délka musí dávat smysl
        const length = ptr.add(4).readS32();
        if (length < 0 || length > 0x10000) return false; // rozumný limit
        
        if (length > 7) {
            // heap pointer nesmí být null
            const dataPtr = ptr.add(8).readPointer();
            if (dataPtr.isNull()) return false;
        }
        
        return true;
    } catch (e) {
        return false;
    }
}

function analyzeProjectilesAndPlayers(objects, count, myTeamId) {
    const now = Date.now();
    const currentIds = new Set();
    for (let i = 0; i < count; i++) {
        try {
            const objPtr = objects.add(i * 8).readPointer();
            if (!objPtr || objPtr.isNull()) continue;

            const dataPtr = natives.LogicGameObjectClient_getData(objPtr);
            if (!dataPtr || dataPtr.isNull()) continue;
            //showFloater(dataPtr.toString())

            const vtable = dataPtr.readPointer();
            const id = natives.LogicGameObjectClient_getGlobalID(objPtr).toString();
            currentIds.add(id);

            const teamId = objPtr.add(64).readU32();
            const x = natives.LogicGameObjectClient_getX(objPtr);
            const y = natives.LogicGameObjectClient_getY(objPtr);

            const table = objPtr.readPointer();
            //const adres = table.sub(base);
            //showFloater(adres.toString());

            //const mod = Process.findModuleByAddress(vtable);
            //if (!mod.isNull()) {
                //const test = vtable.sub(mod.base);
                //showFloater(test.toString());
            //}
            if(vtable.equals(PTR_VTABLE_MYDEATH_DATA)) {
                //showFloater("my dead object");
            }

            const maxHP = objPtr.add(0xac).readS32();
            const currentHP = objPtr.add(0xa8).readS32();
            //showFloater(currentHP.toString());
            //menu.log("updated objects");
            //menu.log("object log: id: " + id + " teamId: " + teamId.toString() + " maxHp: " + maxHp.toString() + " currentHp: " + currentHp.toString());
            
            //if(!vtable.equals(PTR_VTABLE_PROJECTILE_DATA)) {
                //const addres = vtable.sub(base);
                //showFloater(addres.toString());
            //}  
            

            if (vtable.equals(PTR_VTABLE_PROJECTILE_DATA)) {
                const stateFlag = objPtr.add(208).readU32();
                if (teamId === myTeamId || stateFlag !== 0) {
                    //showFloater("bullet");
                    projectiles.delete(id);
                    continue;
                }

                const speed = natives.LogicProjectileData_getSpeed(dataPtr);
                const radius = natives.LogicProjectileData_getRadius(dataPtr);

                const prev = projectiles.get(id) || {};

                let dirx = x - (prev.x || x);
                let diry = y - (prev.y || y);

                const length = Math.sqrt(dirx * dirx + diry * diry);

                if (length > 0) {
                    dirx = dirx / length;
                    diry = diry / length;
                } else {
                    dirx = 0;
                    diry = 0;
                }

                projectiles.set(id, {
                    x: x,
                    y: y,
                    speed: speed,
                    radius: radius,
                    dirX: dirx,
                    dirY: diry,
                    lastSeen: now
                });
            }
        } catch (e) {}
    }

    for (const id of projectiles.keys()) {
        const p = projectiles.get(id);
        if (!currentIds.has(id) || now - p.lastSeen > 1000) {
            projectiles.delete(id);
        }
    }
}

function predictPosition(x, y, dirX, dirY, speed, timeMs) {
    const timeSec = timeMs / 1000;
    return {
        x: x + dirX * speed * timeSec,
        y: y + dirY * speed * timeSec
    };
}

function willCollide(projectile, myX, myY, myRadius) {
    const prediction = predictPosition(
        projectile.x,
        projectile.y,
        projectile.dirX,
        projectile.dirY,
        projectile.speed,
        CONFIG.PREDICTION_TIME_MS
    );

    const dx = prediction.x - myX;
    const dy = prediction.y - myY;
    const distanceSq = dx * dx + dy * dy;
    const collisionRadius = myRadius + projectile.radius;

    return distanceSq <= (collisionRadius * collisionRadius);
}

function getDodgeDirection(projectile, myX, myY) {
    // Směr projektilu
    const projDirX = projectile.dirX;
    const projDirY = projectile.dirY;

    // Vektor od hráče k projektilu
    const toProjX = projectile.x - myX;
    const toProjY = projectile.y - myY;

    // Normálový vektor k směru projektilu (dva možné směry)
    const normal1X = -projDirY;
    const normal1Y = projDirX;
    const normal2X = projDirY;
    const normal2Y = -projDirX;

    // Vybereme normálový vektor, který směřuje "stranou" od projektilu
    // Použijeme vektorový součin pro zjištění směru
    const dotProduct1 = toProjX * normal1X + toProjY * normal1Y;
    const dodgeDirX = dotProduct1 > 0 ? normal1X : normal2X;
    const dodgeDirY = dotProduct1 > 0 ? normal1Y : normal2Y;

    // Normalizujeme vektor úhybu
    const length = Math.sqrt(dodgeDirX * dodgeDirX + dodgeDirY * dodgeDirY);
    if (length > 0) {
        return { x: dodgeDirX / length, y: dodgeDirY / length };
    } else {
        return { x: 1, y: 0 }; // Výchozí směr
    }
}
let someName = "no name";
function objectHandler(objects, count, myTeamId) {
    for (let i = 0; i < count; i++) {
        const objPtr = objects.add(i * 8).readPointer();
        const globalId = natives.LogicGameObjectClient_getGlobalID(objPtr);
        const type = Math.floor(globalId / 1000000);
        const index = globalId % 1000000;

        //someName = "type: " + type.toString() + " index: " + index.toString();
        //log(someName);
        
        //is player
        if(type == 1) {
            const name = objPtr.add(0x220);
            if(isString(name)) {
                const nameString = readString(name);
                log(nameString);
            }else {
                log("doesnt have string");
            }
            //someName = ;
            const teamId = objPtr.add(0xc);
            const playerDisplayData = objPtr.add(0xdc);

            const maxHP = objPtr.add(0xac).readS32();
            const currentHP = objPtr.add(0xa8).readS32();
        }
        //bullet
        if(type == 2) {
        }

        //some entity even explosion and fire circle
        if(type == 3) {
            const maxHP = objPtr.add(0xac).readS32();
            const currentHP = objPtr.add(0xa8).readS32();
        }

        //tick bombs/pirces ammo jars
        if(type == 4) {
            const maxHP = objPtr.add(0xac).readS32();
            const currentHP = objPtr.add(0xa8).readS32();
        }
    }
}

function dodge() {
    Interceptor.attach(base.add(OFFSETS.ClientInput_constructor_int), {
        onEnter: function(args) {
            try {
                if (!state.dodge) return;
                const inputPtr = args[0];
                inputId = args[1];
            } catch (e) {}
        }
    });
    Interceptor.attach(base.add(OFFSETS.ClientInputManager_addInput), {
        onEnter: function(args) {
            try {
                if (!state.dodge) return;
                const inputPtr = args[1];
                const now = Date.now();
                const test = inputPtr.add(8).readS32();
                //showFloater(test.toString());

                if(inputId != 2) return;
                if(inputPtr.isNull()) return;
                if(ownCharacter.isNull()) return;

                const data = natives.LogicGameObjectClient_getData(ownCharacter);
                const myRadius = natives.LogicCharacterData_getCollisionRadius(data);

                if (now - lastDodgeTime > CONFIG.DODGE_COOLDOWN) {
                    const myX = natives.LogicGameObjectClient_getX(ownCharacter);
                    const myY = natives.LogicGameObjectClient_getY(ownCharacter);

                    let needsToDodge = false;
                    let bestDodgeDir = { x: 0, y: 0 };

                    for (const projectile of projectiles.values()) {
                        if (willCollide(projectile, myX, myY, myRadius)) {
                            needsToDodge = true;
                            bestDodgeDir = getDodgeDirection(projectile, myX, myY);
                            break;
                        }
                    }

                    if (needsToDodge) {
                        showFloater("dodge");
                        lastDodgeTime = now;
                        const dodgeStrength = CONFIG.DODGE_DISTANCE;
                        const dodgeMoveX = Math.round(myX + bestDodgeDir.x * dodgeStrength);
                        const dodgeMoveY = Math.round(myY + bestDodgeDir.y * dodgeStrength);

                        inputPtr.add(12).writeS32(dodgeMoveX);
                        inputPtr.add(16).writeS32(dodgeMoveY);
                    }
                }
            } catch (e) {}
        }
    });

    Interceptor.attach(base.add(OFFSETS.LogicBattleModeClient_update), {
        onEnter: function(args) {
            const battleMode = args[0];
            const now = Date.now();
            if (!state.dodge) return;

            try {
                ownCharacter = natives.LogicBattleModeClient_getOwnCharacter(battleMode);
                if (!ownCharacter || ownCharacter.isNull()) return;

                let ownTeamId = natives.LogicBattleModeClient_getOwnPlayerTeam(battleMode);

                const objMgr = battleMode.add(40).readPointer();
                if (!objMgr || objMgr.isNull()) return;

                ownPlayerID = objMgr.add(0x28).readInt();

                const objects = objMgr.readPointer();
                const count = objMgr.add(12).readU32();
                if (!objects || objects.isNull() || count === 0 || count > 1000) return;
                objectHandler(objects, count, ownTeamId);
                analyzeProjectilesAndPlayers(objects, count, ownTeamId);
            } catch (e) {}
        }
    });

    showFloater("dodge loaded");
}

function ghostMode() {
    Interceptor.attach(base.add(OFFSETS.ignoresCollisions), {
        onLeave(retval) {
            //showFloater("colisions 0");
            //retval.replace(0);
            //if(state.ghost) {
                //retval.replace(1);
            //}
        }
    });
}

function dumpStringObject(ptr) {
    log(hexdump(ptr, { length: 32 }).toString());
}

function name() {
    Interceptor.attach(base.add(OFFSETS.decoratedTextFieldSetPlayerName), {
        onEnter: function(args) {
            const playerData = args[1]; 
            //dumpStringObject(args[1]);
            log(playerData.add(0x08).readUtf8String());
            if(!state.name) return;
            const name = "epstein";
            args[1].add(0x08).writeUtf8String(name);
            //dumpStringObject(args[1]);
            args[1].add(0x04).writeU32(name.length);
        }
    });
}

function getRandomSpraySlot() {
    // spray slots are 6–10
    return Math.floor(Math.random() * 5) + 6;
}

function MapData() {
    Interceptor.attach(base.add(OFFSETS.tileBasedRaycast), {
        onEnter: function(args) {
            const mapData = args[4];
            const width  = mapData.add(0xc4).readInt();
            const height = mapData.add(0xc8).readInt();
            const tileArrayPtr = mapData.add(0x20).readPointer();
        }
    });
    Interceptor.attach(base.add(OFFSETS.logicTileMapUpdate), {
        onEnter: function(args) {
            const mapData = args[1]
            const width  = mapData.add(0xc4).readInt();
            const height = mapData.add(0xc8).readInt();
            const tileCount = mapData.add(0xdc).readInt();
            const tilesArrayPtr = mapData.add(0x20).readPointer();

            for (let i = 0; i < tileCount; i++) {
                const tilePtr = tilesArrayPtr.add(i * 8).readPointer();
            
                if (tilePtr.isNull()) continue;
            
                // flagy
                const isDestructible  = tilePtr.add(0x4a).readU8();
                const blocksProj      = tilePtr.add(0x49).readU8();
                const blocksMovement  = tilePtr.add(0x48).readU8();
                const isOpen          = tilePtr.add(0x78).readU8();
                const respawnTimer    = tilePtr.add(0x34).readFloat();
            
                // souřadnice z indexu
                const tileX = i % width;
                const tileY = Math.floor(i / width);

            }
        }
    });
}

function Joysticks() {
    Interceptor.attach(base.add(OFFSETS.handleJoystick), {
        onEnter: function(args) {
            if(!state.joystick) return;
            const joystick = args[0]; // param_1 = JoystickHandler*
        
            // Raw joystick pozice
            const currentX = joystick.add(0x9d0).readFloat();
            const currentY = joystick.add(0x9d4).readFloat();
            const centerX  = joystick.add(0x9d8).readFloat();
            const centerY  = joystick.add(0x9dc).readFloat();
        
            // Delta = jak moc je joystick odtažen od středu
            const deltaX = currentX - centerX;
            const deltaY = currentY - centerY;

            log("deltaX: " + deltaX.toString() + " deltaY: " + deltaY.toString());
        
            // Magnitude (délka vektoru)
            const magnitude = joystick.add(0xfc0).readFloat();
        
            // Rotovaný vektor (world-space)
            const worldX = joystick.add(0xfc4).readFloat();
            const worldY = joystick.add(0xfc8).readFloat();
        
            // Poslední cílová pozice ve hře
            const lastMoveX = joystick.add(0xf3c).readInt();
            const lastMoveY = joystick.add(0xf40).readInt();
        
            // Flagy
            const isActive  = joystick.add(0xee8).readU8();
            const wasMoving = joystick.add(0xeef).readU8();
            const moveActive = joystick.add(0xf0c).readU8();
        }
    });
}

let angles = 0;
let speed = 3;
let circleActive = false;
function Spinner() {
    Interceptor.attach(base.add(OFFSETS.handleJoystick), {
        onEnter: function(args) {
            if(!state.spinner) return;
            const joystick = args[0];
            joystickGlobal = joystick;
        
            const centerX = joystick.add(0x9d8).readFloat();
            const centerY = joystick.add(0x9dc).readFloat();
        
            joystick.add(0x9d0).writeFloat(
                centerX + Math.cos(angles * Math.PI / 180) * 120.0
            );
            joystick.add(0x9d4).writeFloat(
                centerY + Math.sin(angles * Math.PI / 180) * 120.0
            );
        
            //set active
            joystick.add(0xee8).writeU8(1);
            angles = (angles + speed) % 360;

            //log("ee8 (aktivní): " + joystick.add(0xee8).readU8().toString());
            //log("f0e (input povolen): " + joystick.add(0xf0e).readU8().toString());
            //log("fb5 (block1): " + joystick.add(0xfb5).readU8().toString());
            //log("fb6 (block2): " + joystick.add(0xfb6).readU8().toString());
            //log("2d9 (stunovaný): " + args[1].add(0x2d9).readU8().toString());
            //log("magnitude: " + joystick.add(0xfc0).readFloat().toString());
        }
    });
}

const bullets = new Map();
const movementSpeed = 720;

let finalDodge = null;
let dodgeStart = 0;
let dodgeDuration = 0;
let dodging = false;

function calculateDodge(bullet, myX, myY, myRadius, mySpeed) {
    const totalRadius = bullet.radius + myRadius;
    const projDirX = bullet.dirX;
    const projDirY = bullet.dirY;

    const toPlayerX = myX - bullet.x;
    const toPlayerY = myY - bullet.y;

    const distanceAlongPath = toPlayerX * projDirX + toPlayerY * projDirY;

    if (distanceAlongPath < 0) {
        return null;
    }

    const closestX = bullet.x + projDirX * distanceAlongPath;
    const closestY = bullet.y + projDirY * distanceAlongPath;

    const escapeDirX = myX - closestX;
    const escapeDirY = myY - closestY;

    const distToPath = Math.sqrt(escapeDirX * escapeDirX + escapeDirY * escapeDirY);

    if (distToPath > totalRadius) {
        return null;
    }

    const safetyMargin = 2; 
    const distanceToMove = (totalRadius - distToPath) + safetyMargin;
    
    const duration = distanceToMove / mySpeed;

    if (distToPath === 0) {
        return { 
            dirX: -projDirY, 
            dirY: projDirX, 
            duration: (totalRadius + safetyMargin) / mySpeed 
        };
    }

    return { 
        dirX: escapeDirX / distToPath, 
        dirY: escapeDirY / distToPath,
        duration: duration 
    };
}

function handleBullets(objects, count, myTeamId) {
    const now = Date.now();
    for (let i = 0; i < count; i++) {
        const objPtr = objects.add(i * 8).readPointer();
        const globalId = natives.LogicGameObjectClient_getGlobalID(objPtr);
        const dataPtr = natives.LogicGameObjectClient_getData(objPtr);
        if (!dataPtr || dataPtr.isNull()) continue;
        
        const type = Math.floor(globalId / 1000000);
        const index = globalId % 1000000;

        //bullet type = 2
        if(type != 2) continue;
        const teamId = objPtr.add(64).readU32();
        const x = natives.LogicGameObjectClient_getX(objPtr);
        const y = natives.LogicGameObjectClient_getY(objPtr);

        const speed = natives.LogicProjectileData_getSpeed(dataPtr);
        const radius = natives.LogicProjectileData_getRadius(dataPtr);

        if(teamId == myTeamId) continue;

        const prev = bullets.get(globalId) || {};

        let dirx = x - (prev.x || x);
        let diry = y - (prev.y || y);

        const length = Math.sqrt(dirx * dirx + diry * diry);

        if (length > 0) {
            dirx = dirx / length;
            diry = diry / length;
        } else {
            dirx = 0;
            diry = 0;
        }

        bullets.set(globalId, {
            x: x,
            y: y,
            speed: speed,
            radius: radius,
            dirX: dirx,
            dirY: diry,
            lastSeen: now
        });
    }

    for (const id of bullets.keys()) {
        const bullet = bullets.get(id);
        if (now - bullet.lastSeen > 1000) {
            bullets.delete(id);
        }
    }
}

function autododge() {
    Interceptor.attach(base.add(OFFSETS.LogicBattleModeClient_update), {
        onEnter: function(args) {
            const battleMode = args[0];
            if (!state.autododge) return;

            ownCharacter = natives.LogicBattleModeClient_getOwnCharacter(battleMode);
            if (!ownCharacter || ownCharacter.isNull()) return;

            const ownTeamId = natives.LogicBattleModeClient_getOwnPlayerTeam(battleMode);

            const objMgr = battleMode.add(40).readPointer();
            if (!objMgr || objMgr.isNull()) return;

            ownPlayerID = objMgr.add(0x28).readInt();

            const objects = objMgr.readPointer();
            const count = objMgr.add(12).readU32();
            if (!objects || objects.isNull() || count === 0 || count > 1000) return;
            handleBullets(objects, count, ownTeamId);
        }
    });

    Interceptor.attach(base.add(OFFSETS.handleJoystick), {
        onEnter: function(args) {
            if(!state.autododge) return;
            if(ownCharacter.isNull()) return;

            const now = Date.now();

            const joystick = args[0];
        
            const centerX = joystick.add(0x9d8).readFloat();
            const centerY = joystick.add(0x9dc).readFloat();

            const data = natives.LogicGameObjectClient_getData(ownCharacter);
            const myRadius = natives.LogicCharacterData_getCollisionRadius(data);

            const myX = natives.LogicGameObjectClient_getX(ownCharacter);
            const myY = natives.LogicGameObjectClient_getY(ownCharacter);

            for (const bullet of bullets.values()) {
                const  dodge = calculateDodge(bullet, myX, myY, myRadius, movementSpeed);
                if(dodge != null) {
                    finalDodge = dodge;
                    break;
                }
            }

            if(!finalDodge) return;
            if (!dodging) {
                dodgeDuration = finalDodge.duration;
                log(finalDodge.duration.toString());
                dodgeStart = now;
            }           

            if(now - dodgeStart < dodgeDuration * 1000) {
                dodging = true;
                const angle = Math.atan2(finalDodge.dirX, finalDodge.dirY);
                joystick.add(0x9d0).writeFloat(
                    centerX + Math.cos(angle * Math.PI / 180) * 120.0
                );
                joystick.add(0x9d4).writeFloat(
                    centerY + Math.sin(angle * Math.PI / 180) * 120.0
                );

                //set active
                joystick.add(0xee8).writeU8(1);
            }else {
                dodging = false;
                //deactivate
                joystick.add(0xee8).writeU8(0);
            }
        }
    });
}


function main() {
    aimbot();
    dodge();
    //ghostMode(); does nothing because server checks
    MapData();
    name();
    Joysticks();
    Spinner();
    autododge();
    Java.perform(() => {
        Java.scheduleOnMainThread(() => {
            const cl = getClassLoader();
            const activity = getMainActivity(cl);
            const menu = new Menu(cl, activity);
            globalMenu = menu;

            menu.setColors("#635985", "#443C68");

            menu.addButton("aim_bot", "Aim Bot", {
                 on: () => {state.aimbot = true;},
                 off: () => {state.aimbot = false;}
            });

            menu.addButton("dodge", "Auto Dodge", {
                 on: () => {state.dodge = true;},
                 off: () => {state.dodge = false;}
            });

            menu.addButton("test", "Test", {
                 on: () => {
                     state.name = true;
                 },
                 off: () => {state.name = false;}
            });

            menu.addButton("joystick", "Joystick", {
                 on: () => {state.joystick = true;},
                 off: () => {state.joystick = false;}
            });

            menu.addButton("spinner", "Spinner", {
                 on: () => {state.spinner = true;},
                 off: () => {state.spinner = false;}
            });

            menu.addButton("newdodge", "New dodge", {
                 on: () => {state.autododge = true;},
                 off: () => {state.autododge = false;}
            });

            menu.addLogButton();

            menu.start();
        });
    });
}

setTimeout(main, 5000);
