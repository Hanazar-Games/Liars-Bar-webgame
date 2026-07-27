export const LANGUAGES = [
  { code: 'zh-CN', label: '简体中文' },
  { code: 'zh-TW', label: '繁體中文' },
  { code: 'en', label: 'English' },
  { code: 'ja', label: '日本語' },
  { code: 'ko', label: '한국어' },
  { code: 'es', label: 'Español' },
  { code: 'fr', label: 'Français' },
  { code: 'de', label: 'Deutsch' },
  { code: 'pt-BR', label: 'Português' },
  { code: 'ru', label: 'Русский' },
];

const zhCN = {
  settingsTitle: '游戏设置', tutorialTitle: '新手教程', startSolo: '单人牌局', startLan: '局域网联机',
  actionPlay: '出牌', actionChallenge: '质疑', tabExperience: '体验', tabSound: '声音', tabLanguage: '语言',
  tabNews: '公告', tabAbout: '关于', openTutorial: '开始新手教程', done: '完成', next: '下一步', back: '上一步',
  finish: '完成教程', repository: '代码仓库', issues: '问题反馈', discussions: '社区讨论', author: '作者主页',
  home: '返回官网', tutorialProgress: '第 {current} / {total} 步', settingsEyebrow: '酒馆偏好',
  tutorialEyebrow: '第一次入座', motion: '增强动画', visualEffects: '桌面光影', masterSound: '总声音',
  music: '环境音乐', soundEffects: '操作音效', language: '界面语言', news: '最新公告', about: '关于本作',
  tabGameplay: '游戏辅助', resetDefaults: '恢复默认', motionSpeed: '动画速度', cardScale: '手牌缩放',
  sceneBrightness: '场景亮度', sceneContrast: '场景对比度', particles: '浮尘密度', aiSpeed: 'AI 思考节奏',
  autoFocus: '自动聚焦', shortcuts: '键盘快捷键', history: '酒馆耳语', turnEffects: '回合强调',
  ambienceIntensity: '氛围强度', musicWarmth: '环境音温暖度', uiSounds: '界面提示音', gameSounds: '牌局提示音',
  announcementSounds: '公告提示音', cuePitch: '提示音音高',
  tutorial1Title: '看清本局指定牌', tutorial1Copy: '每局只认 A、K 或 Q 中的一种，JOKER 永远可以充当指定牌。',
  tutorial2Title: '暗扣一至三张牌', tutorial2Copy: '选择手牌后出牌。真实牌面不会公开，你可以诚实，也可以撒谎。',
  tutorial3Title: '判断，还是质疑', tutorial3Copy: '轮到你时继续出牌，或质疑上一手。判断错误的人必须扣动左轮。',
  tutorial4Title: '活到最后', tutorial4Copy: '每次击发都会淘汰一名酒客。保持冷静，成为最后仍坐在桌前的人。',
};

const en = {
  settingsTitle: 'Game Settings', tutorialTitle: 'Beginner Tutorial', startSolo: 'Solo Game', startLan: 'LAN Multiplayer',
  actionPlay: 'Play', actionChallenge: 'Challenge', tabExperience: 'Experience', tabSound: 'Sound', tabLanguage: 'Language',
  tabNews: 'News', tabAbout: 'About', openTutorial: 'Start Tutorial', done: 'Done', next: 'Next', back: 'Back',
  finish: 'Finish Tutorial', repository: 'Repository', issues: 'Report an Issue', discussions: 'Discussions', author: 'Author',
  home: 'Official Site', tutorialProgress: 'Step {current} of {total}', settingsEyebrow: 'Tavern Preferences',
  tutorialEyebrow: 'First Time at the Table', motion: 'Enhanced Motion', visualEffects: 'Table Effects', masterSound: 'Master Sound',
  music: 'Ambient Music', soundEffects: 'Sound Effects', language: 'Interface Language', news: 'Latest News', about: 'About',
  tabGameplay: 'Gameplay', resetDefaults: 'Reset Defaults', motionSpeed: 'Motion Speed', cardScale: 'Card Scale',
  sceneBrightness: 'Scene Brightness', sceneContrast: 'Scene Contrast', particles: 'Particle Density', aiSpeed: 'AI Pace',
  autoFocus: 'Automatic Focus', shortcuts: 'Keyboard Shortcuts', history: 'Action History', turnEffects: 'Turn Emphasis',
  ambienceIntensity: 'Ambience Intensity', musicWarmth: 'Ambient Warmth', uiSounds: 'Interface Cues', gameSounds: 'Game Cues',
  announcementSounds: 'Announcement Cues', cuePitch: 'Cue Pitch',
  tutorial1Title: 'Read the target card', tutorial1Copy: 'Each round uses A, K, or Q. A JOKER always counts as the target card.',
  tutorial2Title: 'Play one to three cards', tutorial2Copy: 'Select cards and play them face down. Tell the truth or bluff—the choice is yours.',
  tutorial3Title: 'Trust or challenge', tutorial3Copy: 'On your turn, play again or challenge the last claim. A wrong call pulls the trigger.',
  tutorial4Title: 'Be the last survivor', tutorial4Copy: 'A loaded chamber eliminates a guest. Stay calm and remain at the table to win.',
};

const locale = (overrides) => ({ ...en, ...overrides });

export const TRANSLATIONS = {
  'zh-CN': zhCN,
  'zh-TW': locale({
    settingsTitle: '遊戲設定', tutorialTitle: '新手教學', startSolo: '單人牌局', startLan: '區域網路連線', actionPlay: '出牌',
    actionChallenge: '質疑', tabExperience: '體驗', tabSound: '聲音', tabLanguage: '語言', tabNews: '公告', tabAbout: '關於',
    openTutorial: '開始新手教學', done: '完成', next: '下一步', back: '上一步', finish: '完成教學', repository: '程式碼倉庫',
    issues: '問題回報', discussions: '社群討論', author: '作者主頁', home: '返回官網', tutorialProgress: '第 {current} / {total} 步',
    settingsEyebrow: '酒館偏好', tutorialEyebrow: '第一次入座', motion: '增強動畫', visualEffects: '桌面光影', masterSound: '總聲音',
    music: '環境音樂', soundEffects: '操作音效', language: '介面語言', news: '最新公告', about: '關於本作',
  }),
  en,
  ja: locale({
    settingsTitle: 'ゲーム設定', tutorialTitle: '初心者チュートリアル', startSolo: 'ソロゲーム', startLan: 'LANマルチプレイ',
    actionPlay: 'カードを出す', actionChallenge: '疑う', tabExperience: '体験', tabSound: 'サウンド', tabLanguage: '言語',
    tabNews: 'お知らせ', tabAbout: '情報', openTutorial: 'チュートリアル開始', done: '完了', next: '次へ', back: '戻る',
    finish: 'チュートリアル完了', repository: 'リポジトリ', issues: '問題を報告', discussions: 'ディスカッション', author: '作者ページ', home: '公式サイト',
    tutorialProgress: '{total} ステップ中 {current}', motion: '強化アニメーション', visualEffects: 'テーブル演出', masterSound: 'マスター音量',
    music: '環境音楽', soundEffects: '効果音', language: '表示言語', news: '最新情報', about: 'このゲームについて',
  }),
  ko: locale({
    settingsTitle: '게임 설정', tutorialTitle: '초보자 튜토리얼', startSolo: '싱글 게임', startLan: 'LAN 멀티플레이',
    actionPlay: '카드 내기', actionChallenge: '의심하기', tabExperience: '화면', tabSound: '소리', tabLanguage: '언어', tabNews: '공지',
    tabAbout: '정보', openTutorial: '튜토리얼 시작', done: '완료', next: '다음', back: '이전', finish: '튜토리얼 완료', repository: '저장소',
    issues: '문제 신고', discussions: '토론', author: '제작자', home: '공식 사이트', tutorialProgress: '{total}단계 중 {current}',
    motion: '강화 애니메이션', visualEffects: '테이블 효과', masterSound: '전체 소리', music: '배경 음악', soundEffects: '효과음',
    language: '인터페이스 언어', news: '최신 공지', about: '게임 정보',
  }),
  es: locale({
    settingsTitle: 'Ajustes del juego', tutorialTitle: 'Tutorial para principiantes', startSolo: 'Partida individual', startLan: 'Multijugador LAN',
    actionPlay: 'Jugar', actionChallenge: 'Desafiar', tabExperience: 'Experiencia', tabSound: 'Sonido', tabLanguage: 'Idioma',
    tabNews: 'Novedades', tabAbout: 'Acerca de', openTutorial: 'Iniciar tutorial', done: 'Listo', next: 'Siguiente', back: 'Atrás',
    finish: 'Terminar tutorial', repository: 'Repositorio', issues: 'Informar de un problema', discussions: 'Debates', author: 'Autor',
    home: 'Sitio oficial', tutorialProgress: 'Paso {current} de {total}', motion: 'Animación mejorada', visualEffects: 'Efectos de mesa',
    masterSound: 'Sonido general', music: 'Música ambiental', soundEffects: 'Efectos de sonido', language: 'Idioma de interfaz', news: 'Últimas noticias', about: 'Acerca del juego',
  }),
  fr: locale({
    settingsTitle: 'Paramètres du jeu', tutorialTitle: 'Tutoriel débutant', startSolo: 'Partie solo', startLan: 'Multijoueur LAN',
    actionPlay: 'Jouer', actionChallenge: 'Contester', tabExperience: 'Expérience', tabSound: 'Son', tabLanguage: 'Langue', tabNews: 'Actualités',
    tabAbout: 'À propos', openTutorial: 'Lancer le tutoriel', done: 'Terminé', next: 'Suivant', back: 'Retour', finish: 'Terminer le tutoriel',
    repository: 'Dépôt', issues: 'Signaler un problème', discussions: 'Discussions', author: 'Auteur', home: 'Site officiel',
    tutorialProgress: 'Étape {current} sur {total}', motion: 'Animations renforcées', visualEffects: 'Effets de table', masterSound: 'Son principal',
    music: 'Musique d’ambiance', soundEffects: 'Effets sonores', language: 'Langue de l’interface', news: 'Dernières nouvelles', about: 'À propos du jeu',
  }),
  de: locale({
    settingsTitle: 'Spieleinstellungen', tutorialTitle: 'Einsteiger-Tutorial', startSolo: 'Einzelspiel', startLan: 'LAN-Mehrspieler',
    actionPlay: 'Ausspielen', actionChallenge: 'Anzweifeln', tabExperience: 'Darstellung', tabSound: 'Ton', tabLanguage: 'Sprache',
    tabNews: 'Neuigkeiten', tabAbout: 'Über', openTutorial: 'Tutorial starten', done: 'Fertig', next: 'Weiter', back: 'Zurück',
    finish: 'Tutorial beenden', repository: 'Repository', issues: 'Problem melden', discussions: 'Diskussionen', author: 'Autor', home: 'Offizielle Seite',
    tutorialProgress: 'Schritt {current} von {total}', motion: 'Erweiterte Animationen', visualEffects: 'Tischeffekte', masterSound: 'Gesamtlautstärke',
    music: 'Hintergrundmusik', soundEffects: 'Soundeffekte', language: 'Oberflächensprache', news: 'Neuigkeiten', about: 'Über das Spiel',
  }),
  'pt-BR': locale({
    settingsTitle: 'Configurações do jogo', tutorialTitle: 'Tutorial para iniciantes', startSolo: 'Jogo solo', startLan: 'Multijogador LAN',
    actionPlay: 'Jogar', actionChallenge: 'Desafiar', tabExperience: 'Experiência', tabSound: 'Som', tabLanguage: 'Idioma', tabNews: 'Notícias',
    tabAbout: 'Sobre', openTutorial: 'Iniciar tutorial', done: 'Concluir', next: 'Próximo', back: 'Voltar', finish: 'Concluir tutorial',
    repository: 'Repositório', issues: 'Relatar problema', discussions: 'Discussões', author: 'Autor', home: 'Site oficial',
    tutorialProgress: 'Etapa {current} de {total}', motion: 'Animação aprimorada', visualEffects: 'Efeitos da mesa', masterSound: 'Som geral',
    music: 'Música ambiente', soundEffects: 'Efeitos sonoros', language: 'Idioma da interface', news: 'Últimas notícias', about: 'Sobre o jogo',
  }),
  ru: locale({
    settingsTitle: 'Настройки игры', tutorialTitle: 'Обучение для новичков', startSolo: 'Одиночная игра', startLan: 'Игра по LAN',
    actionPlay: 'Сыграть', actionChallenge: 'Оспорить', tabExperience: 'Интерфейс', tabSound: 'Звук', tabLanguage: 'Язык', tabNews: 'Новости',
    tabAbout: 'Об игре', openTutorial: 'Начать обучение', done: 'Готово', next: 'Далее', back: 'Назад', finish: 'Завершить обучение',
    repository: 'Репозиторий', issues: 'Сообщить о проблеме', discussions: 'Обсуждения', author: 'Автор', home: 'Официальный сайт',
    tutorialProgress: 'Шаг {current} из {total}', motion: 'Улучшенная анимация', visualEffects: 'Эффекты стола', masterSound: 'Общий звук',
    music: 'Фоновая музыка', soundEffects: 'Звуковые эффекты', language: 'Язык интерфейса', news: 'Последние новости', about: 'Об игре',
  }),
};

export function translate(language, key, values = {}) {
  const template = (TRANSLATIONS[language] || TRANSLATIONS['zh-CN'])[key] || key;
  return template.replace(/\{(\w+)\}/g, (_, name) => values[name] ?? `{${name}}`);
}
