# Troubleshooting

Guide de résolution des problèmes courants avec FIC Engine & Inspector.

---

## Problèmes d'installation

### Rust n'est pas reconnu

**Symptôme** : `rustc: command not found`

**Solution** :
```bash
# Linux/macOS
source $HOME/.cargo/env

# Ajouter au profil
echo 'source $HOME/.cargo/env' >> ~/.bashrc
```

---

### Node.js n'est pas reconnu

**Symptôme** : `node: command not found`

**Solution** :
- Vérifier l'installation : `node --version`
- Si installé via nvm, charger : `source ~/.nvm/nvm.sh`

---

## Problèmes de serveur

### Port déjà utilisé

**Symptôme** : `Address already in use`

**Solution** :
```bash
# Trouver le processus (Linux/macOS)
lsof -i :8080

# Tuer le processus
kill -9 <PID>

# Ou changer le port
cargo run --release -- serve --port 9000
```

---

### Le serveur ne démarre pas

**Symptôme** : Erreur au démarrage

**Vérifications** :
1. Le dossier de données existe ?
2. Les permissions sont correctes ?
3. Consulter les logs pour plus de détails

---

## Problèmes de fichiers

### Tables non détectées

**Symptôme** : Le scan ne trouve aucune table

**Solutions** :
1. Vérifier que les fichiers `.fic` existent
2. Vérifier les extensions (`.fic`, pas `.FIC` ou autre)
3. Vérifier le chemin spécifié

```bash
# Vérifier les fichiers
ls -la data/*.fic

# Scanner avec chemin explicite
cargo run --release -- scan /chemin/absolu/vers/data
```

---

### Erreur lors de la lecture d'un fichier

**Symptôme** : `Impossible de lire le header`

**Solutions** :
1. Vérifier que le fichier n'est pas corrompu
2. Vérifier les permissions de lecture
3. Utiliser le mode debug :

```bash
cargo run --release -- debug CLIENT.FIC --dump header
```

---

## Problèmes d'interface

### L'interface ne se connecte pas

**Symptôme** : Erreur de connexion dans l'interface

**Vérifications** :
1. Le serveur est démarré ?
2. L'URL est correcte (`http://127.0.0.1:8080`) ?
3. Le port correspond ?

```bash
# Tester la connexion
curl http://localhost:8080/health
```

---

## 💾 Problèmes de mémoire

### Erreur de mémoire insuffisante

**Symptôme** : Erreur lors de la lecture de gros fichiers

**Solutions** :
1. Utiliser la pagination (`limit` et `offset`)
2. Exporter par petits lots
3. Augmenter la mémoire allouée si nécessaire

---

## 📞 Obtenir de l'aide

Si le problème persiste :

1. Consulter les logs du serveur
2. Utiliser le mode debug
3. Ouvrir une issue sur GitHub
4. Contacter le support : support@fic-engine.fr

---

<div align="center">

✅ **Problème résolu ?** Consultez les [Guides pratiques](step-by-step-backend.md) pour en savoir plus.

</div>

