// audio.js - Motor de sonido para Life Journey (usando Audio para SFX)
const AudioEngine = {
    sfx: {},           // Objetos Audio para efectos
    bgm: null,
    bgmPlaying: false,

    // Sonidos a cargar
    soundsToLoad: {
        jump: 'jump.mp3',
        collectCake: 'collect.mp3',
        defeatEnemy: 'defeat.mp3',
        gameOver: 'gameover.mp3',
        evolve: 'collect.mp3'   // mismo sonido
    },

    init() {
        // Cargar música de fondo
        this.bgm = new Audio('bgm.mp3');
        this.bgm.loop = true;
        this.bgm.volume = 0.4;

        // Cargar cada efecto de sonido
        for (const [key, url] of Object.entries(this.soundsToLoad)) {
            const audio = new Audio(url);
            audio.preload = 'auto';
            audio.volume = 0.7;   // volumen de efectos
            this.sfx[key] = audio;
            console.log(`✅ Audio cargado: ${key} (${url})`);
        }
        console.log('✅ Motor de audio listo');
    },

    // Reproducir un efecto de sonido
    play(soundKey) {
        if (!this.sfx[soundKey]) {
            console.warn(`❌ Sonido no encontrado: ${soundKey}`);
            return;
        }
        try {
            // Clonar el audio para permitir superposición de sonidos
            const clone = this.sfx[soundKey].cloneNode();
            clone.volume = this.sfx[soundKey].volume;
            clone.play().catch(e => console.warn('Error al reproducir', soundKey, e));
        } catch (e) {
            console.warn('Error al reproducir', soundKey, e);
        }
    },

    playBGM() {
        if (this.bgm && !this.bgmPlaying) {
            this.bgm.play().then(() => {
                this.bgmPlaying = true;
                console.log('🎵 Música de fondo iniciada');
            }).catch(err => console.warn('No se pudo iniciar BGM', err));
        }
    },

    pauseBGM() {
        if (this.bgm) {
            this.bgm.pause();
            this.bgmPlaying = false;
        }
    },

    stopBGM() {
        if (this.bgm) {
            this.bgm.pause();
            this.bgm.currentTime = 0;
            this.bgmPlaying = false;
        }
    },

    setVolume(level) {
        if (this.bgm) {
            this.bgm.volume = Math.max(0, Math.min(1, level));
        }
    }
};

// Inicializar al primer clic en cualquier parte
document.addEventListener('click', function iniciarAudio() {
    AudioEngine.init();
    AudioEngine.playBGM();
    document.removeEventListener('click', iniciarAudio);
}, { once: true });