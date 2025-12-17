# Installation

Ce guide vous accompagne dans l'installation complète de FIC Engine & Inspector sur votre système. Nous allons couvrir toutes les étapes nécessaires pour Windows, Linux et macOS.

---

## Prérequis

Avant de commencer, assurez-vous d'avoir les outils suivants installés :

### Outils requis

| Outil | Version minimale | Description |
|-------|------------------|-------------|
| **Rust** | 1.70+ | Langage de programmation pour le backend |
| **Node.js** | 18+ | Runtime JavaScript pour le frontend |
| **npm** | 9+ | Gestionnaire de paquets Node.js |
| **Git** | 2.0+ | Contrôle de version (optionnel, pour cloner le dépôt) |

---

## Installation sur Windows

### Étape 1 : Installer Rust

1. **Télécharger Rust** :
   - Rendez-vous sur [https://rustup.rs/](https://rustup.rs/)
   - Téléchargez `rustup-init.exe`
   - Exécutez l'installateur

2. **Ou via PowerShell** :
   ```powershell
   # Télécharger l'installateur
   Invoke-WebRequest https://win.rustup.rs/x86_64 -OutFile rustup-init.exe
   
   # Lancer l'installation
   .\rustup-init.exe
   ```

3. **Vérifier l'installation** :
   ```powershell
   rustc --version
   cargo --version
   ```

   Vous devriez voir quelque chose comme :
   ```
   rustc 1.75.0 (82e1608df 2023-12-21)
   cargo 1.75.0 (1d8b05cdd 2023-11-20)
   ```

### Étape 2 : Installer Node.js

1. **Télécharger Node.js** :
   - Rendez-vous sur [https://nodejs.org/](https://nodejs.org/)
   - Téléchargez la version LTS (Long Term Support)
   - Exécutez l'installateur

2. **Vérifier l'installation** :
   ```powershell
   node --version
   npm --version
   ```

   Vous devriez voir quelque chose comme :
   ```
   v18.17.0
   9.6.7
   ```

### Étape 3 : Installer Visual Studio Build Tools (optionnel mais recommandé)

Rust nécessite un compilateur C++ sur Windows. Le plus simple est d'installer Visual Studio Build Tools :

1. Téléchargez [Visual Studio Build Tools](https://visualstudio.microsoft.com/downloads/#build-tools-for-visual-studio-2022)
2. Sélectionnez "C++ build tools" lors de l'installation
3. Redémarrez votre terminal après l'installation

---

## Installation sur Linux

### Étape 1 : Installer Rust

```bash
# Télécharger et installer Rust
curl --proto '=https' --tlsv1.2 -sSf https://sh.rustup.rs | sh

# Charger l'environnement Rust dans le shell actuel
source $HOME/.cargo/env

# Vérifier l'installation
rustc --version
cargo --version
```

### Étape 2 : Installer Node.js (via nvm - recommandé)

**Ubuntu/Debian :**

```bash
# Installer les dépendances système
sudo apt-get update
sudo apt-get install -y build-essential curl

# Installer nvm (Node Version Manager)
curl -o- https://raw.githubusercontent.com/nvm-sh/nvm/v0.39.0/install.sh | bash

# Charger nvm dans le shell actuel
export NVM_DIR="$HOME/.nvm"
[ -s "$NVM_DIR/nvm.sh" ] && \. "$NVM_DIR/nvm.sh"

# Installer Node.js LTS
nvm install 18
nvm use 18
nvm alias default 18

# Vérifier l'installation
node --version
npm --version
```

**Ou via le gestionnaire de paquets :**

```bash
# Ubuntu/Debian
curl -fsSL https://deb.nodesource.com/setup_18.x | sudo -E bash -
sudo apt-get install -y nodejs

# Fedora/RHEL
curl -fsSL https://rpm.nodesource.com/setup_18.x | sudo bash -
sudo dnf install -y nodejs
```

---

## Installation sur macOS

### Étape 1 : Installer Rust

```bash
# Télécharger et installer Rust
curl --proto '=https' --tlsv1.2 -sSf https://sh.rustup.rs | sh

# Charger l'environnement Rust dans le shell actuel
source $HOME/.cargo/env

# Vérifier l'installation
rustc --version
cargo --version
```

### Étape 2 : Installer Node.js (via Homebrew - recommandé)

```bash
# Installer Homebrew si ce n'est pas déjà fait
/bin/bash -c "$(curl -fsSL https://raw.githubusercontent.com/Homebrew/install/HEAD/install.sh)"

# Installer Node.js
brew install node@18

# Ajouter Node.js au PATH
echo 'export PATH="/opt/homebrew/opt/node@18/bin:$PATH"' >> ~/.zshrc
source ~/.zshrc

# Vérifier l'installation
node --version
npm --version
```

---

## Installation de FIC Engine

Maintenant que les prérequis sont installés, installons FIC Engine & Inspector.

### Étape 1 : Cloner le dépôt

```bash
# Cloner le dépôt (ou télécharger l'archive ZIP)
git clone https://github.com/votre-org/fic-engine.git
cd fic-engine
```

### Étape 2 : Compiler le backend (Rust)

```bash
# Compiler en mode release (optimisé pour la production)
cargo build --release

# Le binaire sera disponible dans :
# - Windows: target/release/fic.exe
# - Linux/macOS: target/release/fic
```

**Temps d'attente** : La première compilation peut prendre 5-15 minutes car Rust doit compiler toutes les dépendances. Les compilations suivantes seront beaucoup plus rapides.

### Étape 3 : Installer le frontend (Node.js)

```bash
# Aller dans le dossier du frontend
cd fic-inspector

# Installer les dépendances npm
npm install

# Cela peut prendre quelques minutes...
```

---

## Vérification de l'installation

Vérifions que tout est correctement installé.

### Vérifier le backend

```bash
# Depuis la racine du projet
./target/release/fic --help

# Windows:
# target\release\fic.exe --help
```

Vous devriez voir la sortie d'aide du CLI :

```
Moteur bas niveau pour fichiers HFSQL (.fic, .mmo, .ndx)

Usage: fic [OPTIONS] <COMMAND>

Commands:
  scan    Scanne un dossier et détecte les tables HFSQL
  export  Exporte une table vers JSON ou CSV
  serve   Démarre le serveur API HTTP
  debug   Affiche des informations de debug sur un fichier
  help    Print this message or the help of the given subcommand(s)

Options:
  -d, --data-dir <DATA_DIR>    Chemin du dossier contenant les fichiers .fic/.mmo/.ndx
  -c, --config <CONFIG>        Fichier de configuration
  -h, --help                   Print help
```

### Vérifier le frontend

```bash
# Depuis fic-inspector/
npm run build

# Si la compilation réussit sans erreur, c'est bon !
```

---

## Dépannage des problèmes courants

### Problème : "rustc: command not found"

**Solution** : Rust n'est pas dans votre PATH.

```bash
# Linux/macOS
source $HOME/.cargo/env

# Ajouter au fichier de profil (~/.bashrc, ~/.zshrc, etc.)
echo 'source $HOME/.cargo/env' >> ~/.bashrc
```

### Problème : "error: linker `cc` not found" (Linux/macOS)

**Solution** : Le compilateur C n'est pas installé.

```bash
# Ubuntu/Debian
sudo apt-get install build-essential

# Fedora/RHEL
sudo dnf install gcc

# macOS
xcode-select --install
```

### Problème : "npm: command not found"

**Solution** : Node.js n'est pas installé ou pas dans le PATH.

- Vérifiez l'installation avec `node --version`
- Réinstallez Node.js si nécessaire
- Sur Linux avec nvm, n'oubliez pas de faire `source ~/.nvm/nvm.sh`

### Problème : Erreur lors de `npm install`

**Solution** : Plusieurs causes possibles.

1. **Permissions insuffisantes** :
   ```bash
   # Ne pas utiliser sudo avec npm install
   # Si nécessaire, corriger les permissions :
   sudo chown -R $USER:$USER node_modules package-lock.json
   ```

2. **Problème de réseau** :
   ```bash
   # Utiliser un registre npm alternatif ou un proxy
   npm config set registry https://registry.npmjs.org/
   ```

3. **Cache npm corrompu** :
   ```bash
   npm cache clean --force
   rm -rf node_modules package-lock.json
   npm install
   ```

### Problème : Compilation Rust très lente

**Solution** : Optimiser l'environnement Rust.

```bash
# Ajouter des variables d'environnement pour la compilation parallèle
export CARGO_BUILD_JOBS=$(nproc)  # Linux
# ou
export CARGO_BUILD_JOBS=$(sysctl -n hw.ncpu)  # macOS
```

### Problème : Erreur "port already in use" lors du démarrage du serveur

**Solution** : Un autre processus utilise déjà le port 8080.

```bash
# Linux/macOS : trouver le processus
lsof -i :8080
# ou
netstat -ano | findstr :8080  # Windows

# Tuer le processus ou changer le port dans la configuration
```

---

## Prochaines étapes

Une fois l'installation terminée, vous pouvez :

1. **[Premiers pas](first-steps.md)** - Démarrer le serveur et utiliser l'interface
2. **[Configuration](configuration.md)** - Configurer FIC Engine selon vos besoins
3. **[Architecture Backend](../backend/architecture.md)** - Comprendre comment fonctionne le backend

---

## Astuces

### Installation rapide pour développement

Si vous voulez juste tester rapidement :

```bash
# Backend en mode debug (compilation plus rapide mais exécution plus lente)
cargo build

# Frontend en mode dev (avec hot-reload)
cd fic-inspector
npm run dev
```

### Utiliser des versions spécifiques

Si vous avez besoin de versions spécifiques :

```bash
# Rust : utiliser rustup pour gérer les versions
rustup install 1.70.0
rustup default 1.70.0

# Node.js : utiliser nvm (Linux/macOS) ou nvm-windows
nvm install 18.17.0
nvm use 18.17.0
```

---

<div align="center">

✅ **Installation terminée ?** Passez aux [Premiers pas](first-steps.md) !

</div>

