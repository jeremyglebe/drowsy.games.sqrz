// Create instance of a phaser game, with scaled size
var game = new Phaser.Game(800, 600, Phaser.CANVAS, 'game');

// Add all the game states
game.state.add('Boot', Boot);
game.state.add('Sqrz', Sqrz);
game.state.add('Menu', Menu);
game.state.add('Tutorial', Tutorial);

// Start the game
game.state.start('Boot');