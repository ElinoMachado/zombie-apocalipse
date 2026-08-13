import Phaser from 'phaser';
import { gameConfig } from './game/config';
import { VersionBadge } from './ui/VersionBadge';

new VersionBadge();
new Phaser.Game(gameConfig);
