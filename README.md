# Fauxtruc

Site statique d'outils plein écran, en français, sans dépendance ni traceur.

**Écrans de couleur** : 16 couleurs prédéfinies + couleur perso, luminosité, arrêt automatique.

**Outils** : lumière pour visio (température de couleur, plein/cadre/anneau), test de pixels morts, horloge / minuteur / chronomètre, prompteur (miroir, vitesse, texte sauvegardé), bruit blanc/rose/brun, dégradé animé.

**Farces & ambiance** : fausse mise à jour, écran cassé, hacker express, pluie de code, « pas de signal » (mire ou neige), logo rebondissant.

Raccourcis : `F` plein écran · `Échap` quitter · `H` masquer les réglages. Chaque outil a sa propre URL (`#/color/ff0000`, `#/clock`, …). L'écran reste allumé pendant l'utilisation (Wake Lock).

## Lancer en local

Ouvrir `index.html` dans un navigateur, ou :

```bash
python3 -m http.server 8000
```

Hébergeable tel quel sur GitHub Pages, Netlify, Render, etc.
