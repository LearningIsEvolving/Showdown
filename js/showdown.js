(function($){

var app = window.showdownPlugin = {
	start: function(data) {
		this.user = data.user;
		this.nonce = data.nonce;
		this.competitions = new this.Collections.Competitions(data.competitions);
		this.view = new this.Views.Competitions({ collection: this.competitions });
		this.view.inject( '.showdown-plugin' );
	}
};

// Extend wp.Backbone.View with .prepare() and .render()
app.View = wp.Backbone.View.extend({
	render: function() {
		var result = wp.Backbone.View.prototype.render.apply( this, arguments );
		if ( _.isFunction( this.postRender ) ) {
			this.postRender();
		}
		return result;
	},

	prepare: function() {
		if ( ! _.isUndefined( this.model ) && _.isFunction( this.model.toJSON ) ) {
			return this.model.toJSON();
		} else {
			return {};
		}
	}
});

/* ------ */
/* MODELS */
/* ------ */
app.Models = {};

app.Models.Competition = Backbone.Model.extend({
	competitors: {},

	initialize: function() {
		this.competitors = new app.Collections.Competitors( this.get('competitors') || [] );
		this.unset('competitors');
		this.listenTo( this.competitors, 'addVote', this.syncVote );
	},

	syncVote: function( vote, competitor ) {
		var options = { context: this };
		options.data = {
			action: 'showdown_vote',
			competition: this.get('id'),
			competitor: competitor.get('id'),
			_ajax_nonce: app.nonce || null
		};
		wp.ajax.send( options );
	}
});

app.Models.Competitor = Backbone.Model.extend({
	votes: {},

	initialize: function() {
		this.votes = new app.Collections.Votes( this.get('votes') || [] );
		this.unset('votes');
		this.listenTo( this.votes, 'add', this.announceAddVote );
	},

	announceAddVote: function( model, collection ) {
		this.trigger( 'addVote', model, this );
	}
});

app.Models.Vote = Backbone.Model.extend({});

/* ----------- */
/* COLLECTIONS */
/* ----------- */
app.Collections = {};

app.Collections.Competitions = Backbone.Collection.extend({
	model: app.Models.Competition
});

app.Collections.Competitors = Backbone.Collection.extend({
	model: app.Models.Competitor,

	initialize: function() {
		this.listenTo( this, 'addVote', this.makeVoteUnique );
	},

	makeVoteUnique: function( vote, competitor ) {
		var others = _.reject( this.models, function(m){ return m === competitor; } );
		_.each( others, function(c){ c.votes.remove( vote ); } );
	}
});

app.Collections.Votes = Backbone.Collection.extend({
	model: app.Models.Vote
});

/* ----- */
/* VIEWS */
/* ----- */
app.Views = {};

// Competitions view
app.Views.Competitions = app.View.extend({
	className: "competitions",

	initialize: function() {
		_.each( this.collection.models, this.addCompetitionView, this );
	},

	addCompetitionView: function( competition, options ) {
		this.views.add( new app.Views.Competition({ model: competition }), options || {} );
	},

	inject: function( selector ) {
		this.render();
		$(selector).html( this.el );
		this.views.ready();
	}
});

// Competition view
app.Views.Competition = app.View.extend({
	className: "competition",
	template: wp.template("competition"),

	initialize: function() {
		_.each( this.model.competitors.models, this.addCompetitorView, this );
	},

	addCompetitorView: function( competitor, options ) {
		this.views.add( '.competitors', new app.Views.Competitor({ model: competitor }), options || {} );
	}
});

// Competitor view
app.Views.Competitor = app.View.extend({
	className: "competitor",
	template: wp.template( "competitor" ),
	events: {
		'click img.competitor': 'vote'
	},

	initialize: function() {
		_.each( this.model.votes.models, this.addVoteView, this );
		this.listenTo( this.model.votes, 'add', this.addVoteView );
	},

	vote: function() {
		if ( app.user.loggedIn ) {
			this.model.votes.add({
				name: app.user.name,
				gravatar: app.user.gravatar,
				id: app.user.id,
			});
		} else {
			alert( 'Please log in to vote' );
		}
	},

	addVoteView: function( vote, options ) {
		this.views.add( '.votes', new app.Views.Vote({ model: vote }), options || {} );
	}
});

// Vote view
app.Views.Vote = app.View.extend({
	tagName: "li",
	template: wp.template( "vote" ),

	initialize: function() {
		this.listenTo( this.model, 'remove', this.remove );
	}
});

})(jQuery);
