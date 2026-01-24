# Guide de déploiement de SMBOUTIQUE_V2 (FR)

Ce document explique pas à pas comment préparer et déployer l'application (backend Java + frontend React) en production, en privilégiant une méthode simple : Docker + Docker Compose. Il inclut aussi des conseils pour nettoyer le dépôt avant déploiement et des options CI/CD.

> Public cible : développeur débutant / personne qui souhaite héberger l'application sur un VPS (ex. DigitalOcean, OVH, un serveur Ubuntu) ou une plateforme qui accepte des conteneurs Docker.

---

## 1) Pré-requis

- Un serveur Linux (Ubuntu 22.04 par exemple) ou un service Cloud (DigitalOcean droplet, OVH, etc.).
- Accès SSH au serveur.
- Docker et Docker Compose installés sur le serveur (instructions ci‑dessous).
- Git pour cloner le dépôt.
- Un nom de domaine (optionnel mais recommandé) et possibilité de configurer DNS.

---

## 2) Nettoyage recommandé du dépôt (avant déploiement)

Pour éviter d'envoyer des fichiers binaires/artefacts dans Git et réduire la taille du repo :

1. Ajouter (ou mettre à jour) `.gitignore` pour inclure :

```
# Build artifacts
/target/
/dist/
/node_modules/

# Logs / uploads
/backend/logs/
/uploads/
*.log

# Front build
/front-react/dist

# OS / editor
.DS_Store
.vscode/
```

2. Retirer du suivi Git les artefacts déjà trackés (sans supprimer localement) :

```bash
# Exécuter à la racine du repo
git rm -r --cached backend/target
git rm -r --cached node_modules
git rm -r --cached front-react/dist
git rm -r --cached backend/logs

git add .gitignore
git commit -m "Remove generated artifacts from repo and update .gitignore"
```

3. Si vous trouvez des fichiers volumineux dans l'historique (ex : `target/*.jar`), et que vous voulez les **supprimer définitivement** du repo, utilisez un outil comme `bfg` ou `git-filter-repo`. ATTENTION : cela réécrit l'historique et nécessite coordination avec toute l'équipe.

---

## 3) Déployer localement avec Docker (étape d'apprentissage)

Je fournis des Dockerfiles (backend et frontend) et un `docker-compose.yml` d'exemple. Méthode : construire les images et démarrer les services.

1. Construire et démarrer :

```bash
# à la racine du repo
docker compose up -d --build
```

2. Vérifier l'état :

```bash
docker compose ps
# voir logs
docker compose logs -f backend
```

3. Accéder à l'application :
- Front : http://localhost (port 80) si vous mappez le port 80
- API backend : http://localhost:8085

> Nota : les variables d'accès à la base de données sont définies dans `docker-compose.yml` (ex. MYSQL_USER/PASSWORD). En production, stockez-les de façon sécurisée (secrets manager, ou variables d'environnement du système / docker secrets).

---

## 4) Déployer sur un serveur VPS (ex: DigitalOcean)

1. Créer un droplet (Ubuntu 22.04) ou serveur.
2. Se connecter par SSH :

```bash
ssh root@IP_DU_SERVEUR
```

3. Installer Docker et Docker Compose (version récente) :

```bash
# installer Docker
curl -fsSL https://get.docker.com -o get-docker.sh
sh get-docker.sh
usermod -aG docker $USER
# installer docker compose (si non inclus)
sudo apt update && sudo apt install -y docker-compose-plugin
```

4. Cloner votre dépôt :

```bash
git clone https://.../votre-repo.git
cd votre-repo
```

5. Créer un fichier `.env` sécurisé contenant les variables sensibles (exemple `.env.production`) et le placer hors du repo ou sur le serveur seulement :

```
# .env
MYSQL_ROOT_PASSWORD=change_me
MYSQL_DATABASE=smb
MYSQL_USER=smb
MYSQL_PASSWORD=change_me
SPRING_DATASOURCE_URL=jdbc:mysql://db:3306/smb
SPRING_DATASOURCE_USERNAME=smb
SPRING_DATASOURCE_PASSWORD=change_me
```

6. Démarrer en arrière-plan :

```bash
docker compose up -d --build
```

7. (Optionnel) configurer un reverse-proxy (Nginx / Traefik) pour gérer les domaines et TLS (Let's Encrypt).

---

## 5) Déploiement continu (CI/CD) — aperçu simple avec GitHub Actions

- Idée : construire les images et pousser dans Docker Hub / GitHub Container Registry, puis déclencher un déploiement (via SSH et `docker compose pull && docker compose up -d`).

Exemple de workflow (résumé) :
- `on: push` sur `main` ou `release`
- Actions : build backend image, build frontend image, push au registry
- Déployer : SSH sur serveur et exécuter `docker compose pull && docker compose up -d`

Si vous voulez, je peux fournir un workflow GitHub Actions prêt à l'emploi.

---

## 6a) Migrations de base de données (important)

🔧 Cette application n'utilise pas de framework de migration intégré dans le dépôt (Flyway/Liquibase). La modification suivante nécessite une migration SQL à exécuter en production **avant** de déployer la nouvelle version du backend :

- Fichier de migration ajouté : `backend/db/migration/20260120_add_unite_code_and_indexes.sql`
- Objectif : ajouter la colonne `code` sur la table `unite`, backfiller des valeurs, et créer des index/contraintes d'unicité scoped par `id_boutique` (prévenir créations concurrentes et accélérer les recherches par `code`).

Étapes recommandées pour production :

1. Récupérer la migration et vérifier qu'il n'y a pas de doublons :
   - SELECTs au début du fichier montreront les collisions éventuelles (dupliqués par `libelle` ou par `code` attendu).
2. Résoudre manuellement les doublons listés (fusion/suppression) si nécessaire.
3. Exécuter la migration dans une fenêtre de maintenance :

```bash
# depuis une machine ayant accès à la base
mysql -u $DB_USER -p$DB_PASS $DB_NAME < backend/db/migration/20260120_add_unite_code_and_indexes.sql
```

4. Redémarrer le backend et surveiller les erreurs (logs) pendant quelques heures.

Rollback (si une erreur critique est détectée) :
- Avant d'appliquer la migration, prenez un dump SQL complet : `mysqldump -u $DB_USER -p $DB_NAME > pre_migration.sql`.
- En cas de problème : restaurer le dump et revenir à la version précédente du backend.

💡 Astuce : exécutez d'abord la migration sur une copie de production (staging) pour vérifier qu'il n'y a pas de conflits inattendus.

---

## 6) Conseils de production (sécurisé)

- Ne laissez pas de mots de passe dans le dépôt. Utilisez `.env` sur le serveur ou un secrets manager.
- Activez TLS (Let's Encrypt) via Traefik ou Certbot/Nginx.
- Redirigez les logs vers un système de logs (ex. `journald`, Logrotate, ou un service centralisé).

### Correctif important : permissions du répertoire `backend/logs` (empêchent parfois le démarrage)

Si le backend échoue au démarrage avec une erreur Logback du type `java.io.FileNotFoundException: logs/application.log (Permission non accordée)`, corrigez rapidement :

1) Correction immédiate (sur le serveur) :

```bash
# exécuter en tant que sudo sur le serveur d'app
sudo chown -R <deploy-user>:<deploy-group> /path/to/repo/backend/logs
sudo chmod -R 0755 /path/to/repo/backend/logs
# vérifier
ls -ld /path/to/repo/backend/logs && ls -l /path/to/repo/backend/logs/application.log
```

2) Mesure préventive (systemd tmpfiles.d) — crée ` /etc/tmpfiles.d/smboutique.conf` :

```
# /etc/tmpfiles.d/smboutique.conf
d /var/lib/smboutique/logs 0755 <deploy-user> <deploy-group> -
```

(ou adaptez pour `/opt/smboutique/backend/logs` selon votre path)

3) Pendant le développement local, le script `backend/scripts/start_backend.sh` bascule automatiquement sur `/tmp` si `backend/logs` n'est pas inscriptible et affiche la commande `sudo` recommandée.

> ⚠️ Important : corriger la propriété/permissions reste la meilleure solution — un fichier `application.log` root-owned doit être retiré ou repris par l'utilisateur de déploiement.

- Sauvegarde de la base de données et stratégie de restauration.
- Mettre en place monitoring et alerting (UptimeRobot, Prometheus, etc.).

---

## 7) Récapitulatif des commandes utiles

```bash
# Nettoyage
git rm -r --cached backend/target node_modules front-react/dist backend/logs
git add .gitignore
git commit -m "Remove build artifacts from repo and update .gitignore"

# Démarrage local (Docker)
docker compose up -d --build

docker compose logs -f backend

# Build manuelle backend (sans Docker)
cd backend
mvn -DskipTests package
java -jar target/backend-0.0.1-SNAPSHOT.jar
```

---

Si vous voulez, je peux :
- créer ces fichiers de configuration (Dockerfiles + docker-compose) dans le dépôt et une branche dédiée puis ouvrir une PR ;
- ou uniquement créer ce fichier de documentation et vous guider manuellement.

Dites-moi si vous souhaitez que je : **A)** crée et pousse une branche avec le setup Docker + `docker-compose`, ou **B)** crée seulement ce fichier de documentation et vous guidez pour l’étape suivante. 

---

Bonne continuation — dites-moi quelle option vous préférez et je m'en occupe.
