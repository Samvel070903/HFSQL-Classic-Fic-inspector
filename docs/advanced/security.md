# Sécurité

Guide de sécurité et conformité pour FIC Engine & Inspector.

---

## Sécurité des données

### Mode lecture seule

Activez le mode lecture seule en production :

```toml
[storage]
read_only = true
```

Cela empêche toute modification accidentelle des fichiers HFSQL.

---

### Validation des chemins

Le système valide tous les chemins pour éviter les directory traversal attacks.

---

### Limites de taille

- Limite de taille de requête : 10 GB
- Protection contre les fichiers malveillants

---

## Sécurité réseau

### Isolation en développement

En développement, utilisez `127.0.0.1` :

```toml
[api]
host = "127.0.0.1"
```

---

### Production avec HTTPS

Utilisez un reverse proxy avec HTTPS (nginx) :

```nginx
server {
    listen 443 ssl;
    server_name fic-engine.example.com;
    
    ssl_certificate /path/to/cert.pem;
    ssl_certificate_key /path/to/key.pem;
    
    location / {
        proxy_pass http://127.0.0.1:8080;
    }
}
```

---

### Authentification

Pour la production, ajoutez une authentification :

- Utiliser un reverse proxy avec auth (nginx, Apache)
- Ou implémenter l'auth dans l'application

---

## 🔐 Conformité RGPD/CNIL

### Traitement local

✅ Toutes les données restent sur votre infrastructure  
✅ Aucun envoi à des serveurs externes  
✅ Pas de télémétrie

---

### Droit à l'oubli

Les utilisateurs peuvent supprimer les données via l'API :

```bash
DELETE /tables/:table/records/:id
```

---

### Audit trail

Les logs locaux permettent la traçabilité des accès.

---

## Checklist de sécurité

- [ ] Mode lecture seule activé en production
- [ ] HTTPS configuré
- [ ] Authentification en place
- [ ] Logs sécurisés
- [ ] Permissions de fichiers correctes
- [ ] Sauvegardes régulières

---

<div align="center">

✅ **Sécurité configurée ?** Consultez [Performance](performance.md) pour optimiser les performances.

</div>