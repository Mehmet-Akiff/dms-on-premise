import { createI18n } from 'vue-i18n';

const messages = {
  "tr": {
    "nav": {
      "title": "DMS On-Premise",
      "subtitle": "Yapay Zeka Destekli Akıllı Doküman Yönetim Sistemi",
      "dashboard": "Kontrol Paneli",
      "users": "Kullanıcılar",
      "documents": "Belgeler",
      "notifications": "Bildirimler",
      "settings": "Ayarlar",
      "logout": "Çıkış Yap",
      "login": "Giriş Yap",
      "kasaLock": "Kasa Kilidi",
      "systemActive": "Sistem Aktif"
    },
    "common": {
      "save": "Kaydet",
      "cancel": "İptal",
      "edit": "Düzenle",
      "delete": "Sil",
      "add": "Ekle",
      "search": "Ara...",
      "loading": "Yükleniyor...",
      "success": "Başarılı",
      "error": "Hata",
      "warning": "Uyarı"
    },
    "auth": {
      "loginTitle": "DMS Giriş",
      "username": "Kullanıcı Adı",
      "password": "Şifre",
      "loginBtn": "Giriş Yap",
      "cisoLogin": "CISO Girişi",
      "register": "Kayıt Ol",
      "fullName": "Ad Soyad",
      "email": "E-Posta"
    },
    "dashboard": {
      "totalDocs": "Toplam Doküman",
      "last24h": "Son 24 Saat",
      "last7d": "Son 7 Gün",
      "trash": "Çöp Kutusu",
      "categoryDist": "Kategoriye Göre Dağılım"
    },
    "upload": {
      "title": "Doküman Yükle",
      "dragDrop": "Dosyalarınızı buraya sürükleyin",
      "orClick": "veya dosya seçmek için tıklayın",
      "maxLimit": "Maks. 50 MB",
      "uploading": "Yükleniyor...",
      "sending": "Dosya sunucuya gönderiliyor",
      "privacyNotice": "Tüm dosyalar yerel sunucuda güvenle işlenir. Veri dışarı çıkmaz.",
      "tagsLabel": "Etiketler (Enter veya Virgül ile ekleyin)",
      "tagsPlaceholder": "Etiket ekleyin...",
      "sensitivityLabel": "Belge Hassasiyeti",
      "sensitivityPublic": "🟢 Herkese Açık (Standart, Admin, CISO görebilir)",
      "sensitivityMedium": "🟡 Orta Hassas (Sadece Admin ve CISO görebilir)",
      "sensitivityHigh": "🔴 En Hassas (Sadece Admin görebilir)",
      "submitBtn": "Dokümanı Yükle ve İşle"
    },
    "search": {
      "placeholder": "Doküman adı veya içeriğinde ara...",
      "smartSearch": "Akıllı",
      "mode": "ARAMA MODU",
      "category": "KATEGORİ",
      "fileType": "DOSYA TÜRÜ",
      "status": "DURUM",
      "sort": "SIRALAMA",
      "allCategories": "Tüm Kategoriler",
      "allFiles": "Tüm Dosyalar",
      "allStatus": "Tümü",
      "sortByRelevance": "Alaka Düzeyine Göre",
      "searchBtn": "Ara"
    },
    "list": {
      "trashTitle": "Çöp Kutusu (Silinen Belgeler)",
      "searchResults": "Arama Sonuçları",
      "recentDocs": "Son Yüklenen Dokümanlar",
      "backToDocs": "Belgelere Dön",
      "trash": "Çöp Kutusu",
      "live": "Canlı",
      "results": "sonuç",
      "docsCount": "doküman",
      "activeTagFilter": "Aktif Etiket Filtresi:",
      "clearFilter": "Filtreyi Temizle",
      "tags": "Etiketler:"
    },
    "table": {
      "filename": "DOSYA ADI",
      "category": "KATEGORİ",
      "sensitivity": "HASSASİYET",
      "type": "TÜR",
      "status": "DURUM",
      "date": "TARİH"
    }
  },
  "en": {
    "nav": {
      "title": "DMS On-Premise",
      "subtitle": "AI-Powered Smart Document Management System",
      "dashboard": "Dashboard",
      "documents": "Documents",
      "auditLogs": "Audit Logs",
      "notifications": "Notifications",
      "users": "Users",
      "settings": "Settings",
      "logout": "Logout",
      "login": "Login",
      "kasaLock": "Vault Lock",
      "systemActive": "System Active"
    },
    "common": {
      "save": "Save",
      "cancel": "Cancel",
      "edit": "Edit",
      "delete": "Delete",
      "add": "Add",
      "search": "Search...",
      "loading": "Loading...",
      "success": "Success",
      "error": "Error",
      "warning": "Warning"
    },
    "auth": {
      "loginTitle": "DMS Login",
      "username": "Username",
      "password": "Password",
      "loginBtn": "Login",
      "cisoLogin": "CISO Login",
      "register": "Register",
      "fullName": "Full Name",
      "email": "Email"
    },
    "dashboard": {
      "totalDocs": "Total Documents",
      "last24h": "Last 24 Hours",
      "last7d": "Last 7 Days",
      "trash": "Trash Can",
      "categoryDist": "Distribution by Category"
    },
    "upload": {
      "title": "Upload Document",
      "dragDrop": "Drag and drop your files here",
      "orClick": "or click to select a file",
      "maxLimit": "Max. 50 MB",
      "uploading": "Uploading...",
      "sending": "Sending file to server",
      "privacyNotice": "All files are safely processed on local server. Data does not leave.",
      "tagsLabel": "Tags (Add with Enter or Comma)",
      "tagsPlaceholder": "Add tag...",
      "sensitivityLabel": "Document Sensitivity",
      "sensitivityPublic": "🟢 Public (Standard, Admin, CISO)",
      "sensitivityMedium": "🟡 Medium Sensitive (Admin and CISO only)",
      "sensitivityHigh": "🔴 Highly Sensitive (Admin only)",
      "submitBtn": "Upload and Process Document"
    },
    "search": {
      "placeholder": "Search document name or content...",
      "smartSearch": "Smart",
      "mode": "SEARCH MODE",
      "category": "CATEGORY",
      "fileType": "FILE TYPE",
      "status": "STATUS",
      "sort": "SORT",
      "allCategories": "All Categories",
      "allFiles": "All Files",
      "allStatus": "All",
      "sortByRelevance": "By Relevance",
      "searchBtn": "Search"
    },
    "list": {
      "trashTitle": "Trash (Deleted Documents)",
      "searchResults": "Search Results",
      "recentDocs": "Recently Uploaded Documents",
      "backToDocs": "Back to Documents",
      "trash": "Trash",
      "live": "Live",
      "results": "results",
      "docsCount": "documents",
      "activeTagFilter": "Active Tag Filter:",
      "clearFilter": "Clear Filter",
      "tags": "Tags:"
    },
    "table": {
      "filename": "FILENAME",
      "category": "CATEGORY",
      "sensitivity": "SENSITIVITY",
      "type": "TYPE",
      "status": "STATUS",
      "date": "DATE"
    }
  },
  "de": {
    "nav": {
      "title": "DMS On-Premise",
      "dashboard": "Dashboard",
      "users": "Benutzer",
      "documents": "Dokumente",
      "settings": "Einstellungen",
      "logout": "Abmelden",
      "login": "Anmelden",
      "kasaLock": "Tresorsperre"
    },
    "common": {
      "save": "Speichern",
      "cancel": "Abbrechen",
      "edit": "Bearbeiten",
      "delete": "Löschen",
      "add": "Hinzufügen",
      "search": "Suchen...",
      "loading": "Laden...",
      "success": "Erfolg",
      "error": "Fehler",
      "warning": "Warnung"
    },
    "auth": {
      "loginTitle": "DMS Anmeldung",
      "username": "Benutzername",
      "password": "Passwort",
      "loginBtn": "Anmelden",
      "cisoLogin": "CISO Anmelden",
      "register": "Registrieren",
      "fullName": "Vollständiger Name",
      "email": "E-Mail"
    },
    "dashboard": {
      "totalDocs": "Gesamte Dokumente",
      "last24h": "Letzte 24 Std",
      "last7d": "Letzte 7 Tage",
      "trash": "Papierkorb",
      "categoryDist": "Verteilung nach Kategorie"
    },
    "upload": {
      "title": "Dokument hochladen",
      "dragDrop": "Ziehen Sie Ihre Dateien hierher",
      "orClick": "oder klicken Sie zum Auswählen",
      "maxLimit": "Max. 50 MB",
      "uploading": "Wird hochgeladen...",
      "sending": "Datei wird an den Server gesendet",
      "privacyNotice": "Alle Dateien werden sicher auf dem lokalen Server verarbeitet."
    }
  },
  "fr": {
    "nav": {
      "title": "DMS On-Premise",
      "dashboard": "Tableau de bord",
      "users": "Utilisateurs",
      "documents": "Documents",
      "settings": "Paramètres",
      "logout": "Déconnexion",
      "login": "Connexion",
      "kasaLock": "Verrou"
    },
    "common": {
      "save": "Enregistrer",
      "cancel": "Annuler",
      "edit": "Modifier",
      "delete": "Supprimer",
      "add": "Ajouter",
      "search": "Rechercher...",
      "loading": "Chargement...",
      "success": "Succès",
      "error": "Erreur",
      "warning": "Avertissement"
    },
    "auth": {
      "loginTitle": "DMS Connexion",
      "username": "Nom d'utilisateur",
      "password": "Mot de passe",
      "loginBtn": "Se connecter",
      "cisoLogin": "CISO Connexion",
      "register": "S'inscrire",
      "fullName": "Nom complet",
      "email": "E-mail"
    },
    "dashboard": {
      "totalDocs": "Total Documents",
      "last24h": "Dernières 24h",
      "last7d": "7 derniers jours",
      "trash": "Corbeille",
      "categoryDist": "Répartition par catégorie"
    },
    "upload": {
      "title": "Téléverser un document",
      "dragDrop": "Glissez et déposez vos fichiers ici",
      "orClick": "ou cliquez pour sélectionner un fichier",
      "maxLimit": "Max. 50 Mo",
      "uploading": "Téléversement...",
      "sending": "Envoi du fichier au serveur",
      "privacyNotice": "Tous les fichiers sont traités en toute sécurité sur le serveur local."
    }
  },
  "es": {
    "nav": {
      "title": "DMS On-Premise",
      "dashboard": "Panel de Control",
      "users": "Usuarios",
      "documents": "Documentos",
      "settings": "Configuración",
      "logout": "Cerrar Sesión",
      "login": "Iniciar Sesión",
      "kasaLock": "Bloqueo"
    },
    "common": {
      "save": "Guardar",
      "cancel": "Cancelar",
      "edit": "Editar",
      "delete": "Eliminar",
      "add": "Añadir",
      "search": "Buscar...",
      "loading": "Cargando...",
      "success": "Éxito",
      "error": "Error",
      "warning": "Advertencia"
    },
    "auth": {
      "loginTitle": "DMS Iniciar Sesión",
      "username": "Usuario",
      "password": "Contraseña",
      "loginBtn": "Iniciar Sesión",
      "cisoLogin": "Acceso CISO",
      "register": "Registrarse",
      "fullName": "Nombre Completo",
      "email": "Correo Electrónico"
    },
    "dashboard": {
      "totalDocs": "Documentos Totales",
      "last24h": "Últimas 24h",
      "last7d": "Últimos 7 días",
      "trash": "Papelera",
      "categoryDist": "Distribución por Categoría"
    },
    "upload": {
      "title": "Subir Documento",
      "dragDrop": "Arrastre y suelte sus archivos aquí",
      "orClick": "o haga clic para seleccionar un archivo",
      "maxLimit": "Máx. 50 MB",
      "uploading": "Subiendo...",
      "sending": "Enviando archivo al servidor",
      "privacyNotice": "Todos los archivos se procesan de forma segura en el servidor local."
    }
  },
  "ru": {
    "nav": {
      "title": "DMS On-Premise",
      "dashboard": "Панель управления",
      "users": "Пользователи",
      "documents": "Документы",
      "settings": "Настройки",
      "logout": "Выйти",
      "login": "Войти",
      "kasaLock": "Замок"
    },
    "common": {
      "save": "Сохранить",
      "cancel": "Отмена",
      "edit": "Изменить",
      "delete": "Удалить",
      "add": "Добавить",
      "search": "Поиск...",
      "loading": "Загрузка...",
      "success": "Успешно",
      "error": "Ошибка",
      "warning": "Предупреждение"
    },
    "auth": {
      "loginTitle": "DMS Вход",
      "username": "Имя пользователя",
      "password": "Пароль",
      "loginBtn": "Войти",
      "cisoLogin": "CISO Вход",
      "register": "Регистрация",
      "fullName": "Полное имя",
      "email": "Эл. почта"
    },
    "dashboard": {
      "totalDocs": "Всего документов",
      "last24h": "За 24 часа",
      "last7d": "За 7 дней",
      "trash": "Корзина",
      "categoryDist": "Распределение по категориям"
    },
    "upload": {
      "title": "Загрузить документ",
      "dragDrop": "Перетащите файлы сюда",
      "orClick": "или нажмите для выбора файла",
      "maxLimit": "Макс. 50 МБ",
      "uploading": "Загрузка...",
      "sending": "Отправка файла на сервер",
      "privacyNotice": "Все файлы надежно обрабатываются на локальном сервере."
    }
  },
  "ar": {
    "nav": {
      "title": "DMS On-Premise",
      "dashboard": "لوحة التحكم",
      "users": "المستخدمون",
      "documents": "المستندات",
      "settings": "الإعدادات",
      "logout": "تسجيل الخروج",
      "login": "تسجيل الدخول",
      "kasaLock": "قفل الخزنة"
    },
    "common": {
      "save": "حفظ",
      "cancel": "إلغاء",
      "edit": "تعديل",
      "delete": "حذف",
      "add": "إضافة",
      "search": "بحث...",
      "loading": "جاري التحميل...",
      "success": "نجاح",
      "error": "خطأ",
      "warning": "تحذير"
    },
    "auth": {
      "loginTitle": "تسجيل الدخول DMS",
      "username": "اسم المستخدم",
      "password": "كلمة المرور",
      "loginBtn": "دخول",
      "cisoLogin": "دخول CISO",
      "register": "تسجيل جديد",
      "fullName": "الاسم الكامل",
      "email": "البريد الإلكتروني"
    },
    "dashboard": {
      "totalDocs": "إجمالي المستندات",
      "last24h": "آخر 24 ساعة",
      "last7d": "آخر 7 أيام",
      "trash": "سلة المهملات",
      "categoryDist": "التوزيع حسب الفئة"
    },
    "upload": {
      "title": "تحميل المستند",
      "dragDrop": "اسحب وأفلت ملفاتك هنا",
      "orClick": "أو انقر لاختيار ملف",
      "maxLimit": "الحد الأقصى 50 ميغابايت",
      "uploading": "جاري التحميل...",
      "sending": "جاري إرسال الملف إلى الخادم",
      "privacyNotice": "يتم معالجة جميع الملفات بأمان على الخادم المحلي."
    }
  }
};

const savedLocale = localStorage.getItem('dms_locale') || 'tr';

const i18n = createI18n({
  legacy: false,
  globalInjection: true,
  locale: savedLocale,
  fallbackLocale: 'tr',
  messages,
});

export default i18n;
