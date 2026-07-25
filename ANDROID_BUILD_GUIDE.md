# Guide de Construction APK - SM (System Management)

**Développé par ING Amos JOSEPH**

## Prérequis

1. **Android Studio** installé (dernière version)
2. **Java JDK 17** ou supérieur
3. **Node.js** et **npm** installés

## Étape 1: Préparer le projet

```bash
# Cloner le projet depuis GitHub
git clone <votre-repo>
cd <votre-projet>

# Installer les dépendances
npm install

# Construire le projet web
npm run build
```

## Étape 2: Synchroniser avec Android

```bash
# Synchroniser les fichiers web avec Android
npx cap sync android
```

## Étape 3: Générer une clé de signature (première fois seulement)

```bash
# Créer un keystore pour signer l'APK
keytool -genkey -v -keystore sm-release-key.jks -keyalg RSA -keysize 2048 -validity 10000 -alias sm-key
```

**IMPORTANT**: Gardez le mot de passe et le fichier keystore en sécurité ! Vous en aurez besoin pour chaque mise à jour.

## Étape 4: Configurer la signature

Créez un fichier `android/gradle.properties` avec vos informations de signature:

```properties
RELEASE_STORE_FILE=../sm-release-key.jks
RELEASE_STORE_PASSWORD=votre_mot_de_passe_keystore
RELEASE_KEY_ALIAS=sm-key
RELEASE_KEY_PASSWORD=votre_mot_de_passe_key
```

## Étape 5: Générer l'APK de production

### Option A: Via Android Studio (Recommandé)

1. Ouvrez le dossier `android` dans Android Studio
2. Menu **Build** → **Generate Signed Bundle / APK**
3. Sélectionnez **APK**
4. Choisissez votre keystore et entrez les mots de passe
5. Sélectionnez **release** comme build variant
6. L'APK sera dans `android/app/release/app-release.apk`

### Option B: Via ligne de commande

```bash
cd android

# Sur Windows
gradlew.bat assembleRelease

# Sur Mac/Linux
./gradlew assembleRelease
```

L'APK signé sera dans: `android/app/build/outputs/apk/release/app-release.apk`

## Étape 6: Générer un App Bundle (pour Google Play)

Pour publier sur le Play Store, générez un Android App Bundle:

```bash
cd android

# Sur Windows
gradlew.bat bundleRelease

# Sur Mac/Linux
./gradlew bundleRelease
```

Le bundle sera dans: `android/app/build/outputs/bundle/release/app-release.aab`

## Informations de l'application

| Propriété | Valeur |
|-----------|--------|
| Nom | SM - System Management |
| Package | app.lovable.sm |
| Version | 1.0.0 |
| Version Code | 1 |
| Développeur | ING Amos JOSEPH |

## Mise à jour de la version

Avant chaque nouvelle release, modifiez dans `android/app/build.gradle`:

```gradle
defaultConfig {
    versionCode 2          // Incrémenter à chaque release
    versionName "1.1.0"    // Version affichée
}
```

## Conseils de sécurité

1. **Ne jamais commiter** le fichier keystore ou les mots de passe dans Git
2. **Sauvegardez** votre keystore dans un endroit sûr
3. Si vous perdez le keystore, vous ne pourrez plus mettre à jour l'app sur le Play Store

## Résolution des problèmes

### Erreur "SDK location not found"

Créez un fichier `android/local.properties`:
```properties
sdk.dir=/chemin/vers/Android/sdk
```

### Erreur de mémoire Gradle

Ajoutez dans `android/gradle.properties`:
```properties
org.gradle.jvmargs=-Xmx4096m
```

---

*SM - System Management © 2025 - ING Amos JOSEPH*
