# Guide de déploiement — branche `hebergement` ✅

Ce document explique, étape par étape, comment déployer la version contenue dans la branche `hebergement` sur un serveur Linux (production/test). Il couvre la méthode recommandée (Docker Compose), une alternative sans conteneur, la configuration TLS/reverse-proxy et les vérifications post-déploiement.

---

## ⚙️ Pré-requis

- Un serveur Linux (Debian/Ubuntu/CentOS...) avec accès SSH
- Docker et Docker Compose installés (compose v2 recommandé)
- Git (pour récupérer la branche)
- Nom de domaine pointant vers le serveur (recommandé pour TLS)
- Ports ouverts : 80 (HTTP) et 443 (HTTPS) ; ports applicatifs si vous n'utilisez pas de reverse proxy

Commandes d'installation rapides (Ubuntu/Debian) :

```bash
# Docker
sudo apt update
sudo apt install -y ca-certificates curl gnupg lsb-release
curl -fsSL https://get.docker.com | sudo sh
# Docker Compose v2 (si nécessaire)
sudo apt install -y docker-compose-plugin
# Git
sudo apt install -y git
```

---

## 1) Récupérer la branche `hebergement`

Sur votre serveur, dans le dossier de déploiement (ex: `/opt/smboutique`) :

```bash
sudo mkdir -p /opt/smboutique && cd /opt/smboutique
sudo chown $USER:$USER .
git clone <URL_DU_REPO> .
# ou si le repo existe déjà :
# git fetch origin && git checkout hebergement && git pull origin hebergement
git fetch origin
git checkout hebergement
git pull --ff-only origin hebergement
```

> Remplacez `<URL_DU_REPO>` par l’URL de votre dépôt (SSH ou HTTPS).

---

## 2) Déploiement recommandé : Docker Compose (production)

La branche `hebergement` contient des Dockerfile multi-stage et un `docker-compose.yml` prêt à être utilisé.

1. Préparer les variables d'environnement
   - Créez un fichier `.env.production` ou `.env` (non commité) contenant les variables sensibles (DB, secrets, mots de passe). Exemple :

```env
MYSQL_ROOT_PASSWORD=changeme
MYSQL_DATABASE=smbdb
MYSQL_USER=smb
MYSQL_PASSWORD=secret
VITE_API_BASE=https://example.com/api
# Autres variables spécifiques à l'application
```

2. Démarrer la stack (mode recommandé) :

```bash
# depuis la racine du repo où se trouve docker-compose.yml
sudo docker compose pull || true         # optionnel : pull des images pré-publiées
sudo docker compose up -d --build --remove-orphans
```

3. Vérifications de base :

```bash
sudo docker compose ps
sudo docker compose logs -f backend
# Tester l'API (si accessible localement)
curl -I http://localhost:8086/api/boutiques # ou l'URL configurée
```

Conseils utiles :
- Pour une configuration plus stricte, créez `docker-compose.prod.yml` et utilisez `-f docker-compose.yml -f docker-compose.prod.yml`.
- Pensez à tagger les images (`image: myregistry/smboutique-backend:latest`) et utiliser un registre privé (DockerHub, GHCR, ACR) pour déployer sur plusieurs serveurs.

---

## 3) Alternative : build & lancer sans Docker

Si vous préférez exécuter les services directement :

Backend (Java / Maven) :

```bash
cd backend
./mvnw -DskipTests package
# Exécuter :
java -jar target/backend-0.0.1-SNAPSHOT.jar --spring.profiles.active=prod
```

Frontend (React / Vite) :

```bash
cd front-react
npm ci
npm run build
# Copier le contenu de `dist/` dans un serveur web (nginx) ou lancer un container nginx qui sert `dist/`
```

Note : cette approche nécessite que vous gériez la mise en route et la supervision des processus (systemd, pm2, etc.).

---

## 4) Reverse proxy & TLS (recommandé)

Utilisez un reverse proxy (nginx, Caddy, Traefik) pour :
- fournir TLS (Let's Encrypt)
- exposer le frontend sur `/` et proxyfier `/api` vers le backend

Exemple (snippet nginx) :

```nginx
server {
    listen 80;
    server_name example.com;
    location / {
        proxy_pass http://127.0.0.1:8081; # frontend nginx container or static server
        try_files $uri $uri/ /index.html;
    }
    location /api/ {
        proxy_pass http://127.0.0.1:8086; # backend
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
    }
}
```

Pour TLS, utilisez Certbot or Caddy (Caddy automatise TLS) :

```bash
sudo apt install certbot python3-certbot-nginx
sudo certbot --nginx -d example.com
```

---

## 5) Base de données & volumes

- Le `docker-compose.yml` utilise typiquement un volume pour MySQL. Assurez-vous que le volume est persistant (`/var/lib/docker/volumes/...`).
- Sauvegarde rapide :

```bash
sudo docker exec -i <mysql-container> mysqldump -u root -p${MYSQL_ROOT_PASSWORD} ${MYSQL_DATABASE} > backup.sql
```

- Restauration :

```bash
docker exec -i <mysql-container> mysql -u root -p${MYSQL_ROOT_PASSWORD} ${MYSQL_DATABASE} < backup.sql
```

---

## 6) Supervision & logs

- Afficher logs : `sudo docker compose logs -f --tail 200`
- Statut : `sudo docker compose ps`
- Redémarrer un service : `sudo docker compose restart backend`

---

## 7) Rollback & déploiement d'une version spécifique

- Pour déployer une version/tag précis :

```bash
git fetch --tags
git checkout tags/<TAG> -b deploy/<TAG>
sudo docker compose up -d --build
```

- Pour revenir à la version précédente : `git checkout hebergement~1 && docker compose up -d --build`

---

## 8) Checklist avant mise en production ✅

- [ ] Sauvegarde DB prise
- [ ] Variables d'environnement (`.env.production`) renseignées et sécurisées
- [ ] Reverse proxy & TLS configurés
- [ ] Ports ouverts et firewall ajusté
- [ ] Certificats valides
- [ ] Tests rapides : accès frontend, endpoints `/api/*`

---

## 9) Problèmes fréquents et solutions

- 502 Bad Gateway : vérifier que le backend tourne et que le proxy pointe au bon port
- 404 sur routes SPA (ex: `/configuration`) : s'assurer que `try_files $uri $uri/ /index.html` est en place
- Images manquantes dans dist : vérifier que les images sont importées et que `npm run build` a été exécuté
- Erreurs de build Docker (timeouts lors du pull) : relancer `docker compose pull` puis `docker compose up -d --build`

---

## 10) Pour aller plus loin (optionnel)

- Mettre en place CI/CD (GitHub Actions) : builder backend & frontend, pousser images vers registry, puis déployer via SSH/registry
- Automatiser backups et snapshots
- Configurer monitoring (Prometheus/Grafana) et alerting

---

Si vous le souhaitez, je peux :
- Générer un `docker-compose.prod.yml` prêt à l'emploi
- Créer un workflow GitHub Actions pour construire/pusher les images et déployer
- Ajouter un exemple `systemd` unit pour démarrer la stack au boot

---

**Emplacement du fichier :** `DEPLOY_HEBERGEMENT.md` (à la racine du repo)

Bonne mise en place ! 🔧 Si vous voulez, je peux automatiser la CI/CD ou préparer le fichier `docker-compose.prod.yml` maintenant.