import React, { useState } from 'react';
import { routes, sectionLabels } from '../config/routes.js';
import { requestJson } from '../services/api.js';
import { routeClick } from '../utils/navigation.js';
import { can } from '../utils/permissions.js';

/** Lista publicaciones de foro, guias o intel segun la seccion recibida. */
export function ContentPage({ section, state, setState, currentUser, navigate, stateError }) {
  const items = [...(state.content?.[section] || [])].reverse();
  const canPublish = can(currentUser, 'content.publish') && (section !== 'guides' || can(currentUser, 'content.publish.guides'));
  async function vote(postId, value) { setState(await requestJson('/api/vote', { method: 'POST', body: JSON.stringify({ postId, vote: value }) })); }
  async function comment(postId, text) { setState(await requestJson('/api/comment', { method: 'POST', body: JSON.stringify({ postId, text }) })); }
  return <main className="container"><section className="page-heading"><div><span className="section-label">{sectionLabels[section]}</span><h2>{sectionLabels[section]}</h2></div><a className="action-btn primary-action" href={routes.editor + '?type=' + section} onClick={(event) => { if (!canPublish) return routeClick(event, routes.login, navigate); routeClick(event, routes.editor + '?type=' + section, navigate); }}>Publicar</a></section>{stateError && <section className="ships-status">{stateError}</section>}{!items.length ? <div className="empty-state"><strong>No hay publicaciones todavia</strong><p>Cuando un usuario publique contenido, aparecera aqui.</p></div> : <section className="post-list">{items.map((item) => <PostCard key={item.id} item={item} votes={state.interactions?.votes?.[item.id] || { up: 0, down: 0 }} comments={state.interactions?.comments?.[item.id] || []} onVote={vote} onComment={comment} canComment={can(currentUser, 'content.comment')} canVote={can(currentUser, 'content.vote')} />)}</section>}</main>;
}

/** Tarjeta de una publicacion con votos, imagenes y comentarios. */
function PostCard({ item, votes, comments, onVote, onComment, canComment, canVote }) {
  const [commentText, setCommentText] = useState('');
  return <article className="post-card"><h3>{item.title}</h3>{item.contentHtml ? <div className="post-body" dangerouslySetInnerHTML={{ __html: item.contentHtml }} /> : <p>{item.content}</p>}{!!item.images?.length && <div className="post-gallery">{item.images.map((image) => <img key={image.src} src={image.src} alt={image.name || item.title} />)}</div>}<div className="post-footer"><span>{item.author || 'Stanton Hub'}</span><span>{item.date}</span></div><div className="post-interactions"><div className="vote-controls" aria-label="Votos"><button type="button" onClick={() => onVote(item.id, 1)} disabled={!canVote}>+ {votes.up || 0}</button><button type="button" onClick={() => onVote(item.id, -1)} disabled={!canVote}>- {votes.down || 0}</button></div><details className="comments-panel"><summary>{comments.length} comentarios</summary><div className="comment-list">{comments.length ? comments.map((comment) => <article className="comment-item" key={comment.id}><strong>{comment.author}</strong><p>{comment.text}</p><span>{comment.date}</span></article>) : <p className="empty-comments">Sin comentarios todavia.</p>}</div><form className="comment-form" onSubmit={(event) => { event.preventDefault(); if (!commentText.trim()) return; onComment(item.id, commentText.trim()).then(() => setCommentText('')); }}><input type="text" value={commentText} onChange={(event) => setCommentText(event.target.value)} placeholder={canComment ? 'Anadir comentario' : 'Necesitas permisos para comentar'} maxLength="240" disabled={!canComment} required /><button type="submit" disabled={!canComment}>Comentar</button></form></details></div></article>;
}
