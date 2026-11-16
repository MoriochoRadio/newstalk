// 종목 토론 (F-20): 글·댓글 쓰기, 내 글·댓글 지우기(확인 후), 공감 1번(다시 누르면 취소)
// V7 에 없던 댓글 화면을 붙임 (GET·POST /api/posts/{id}/comments, DELETE /api/comments/{id})
// 실패하면 쓰던 글을 지우지 않고 서버 문장을 그대로 보여 줌
import { useEffect, useRef, useState } from 'react';
import { Heart, MessageCircle, PenLine, Trash2 } from 'lucide-react';
import { boardApi } from '../../api';
import { useApi } from '../../hooks/useApi';
import { useSession } from '../app/session';
import { errorText } from '../lib/errors';
import { relativeTime } from '../lib/format';
import { useConfirm } from './Confirm';
import { Empty, ErrorBox, Pager, SkeletonRows } from './ui';

const PAGE_SIZE = 10;

function PostForm({ stockCode, onDone }) {
  const { handleAuthError, toast } = useSession();
  const [title, setTitle] = useState('');
  const [content, setContent] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  const submit = async (e) => {
    e.preventDefault();
    if (!title.trim() || !content.trim()) {
      setError('제목과 내용을 모두 입력해 주세요.');
      return;
    }
    setBusy(true);
    setError('');
    try {
      await boardApi.write(stockCode, title.trim(), content.trim());
      setTitle('');
      setContent('');
      toast('글을 올렸어요.');
      onDone();
    } catch (err) {
      if (!handleAuthError(err)) setError(errorText(err, '글을 올리지 못했어요.'));
    } finally {
      setBusy(false);
    }
  };

  return (
    <form className="post-form" onSubmit={submit}>
      <label className="sr-only" htmlFor="post-title">
        제목
      </label>
      {/* 글쓰기를 누르면 바로 제목칸으로 (11/13 사용자 눈으로: 열려도 커서가 없어 한 번 더 눌러야 했음). 사용자가 연 폼이라 autoFocus */}
      {/* eslint-disable-next-line jsx-a11y/no-autofocus */}
      <input id="post-title" className="input" autoFocus autoComplete="off" placeholder="제목" maxLength={200} value={title} onChange={(e) => setTitle(e.target.value)} />
      <label className="sr-only" htmlFor="post-content">
        내용
      </label>
      <textarea
        id="post-content"
        className="textarea"
        placeholder="이 종목에 대한 생각을 나눠 주세요"
        maxLength={5000}
        value={content}
        onChange={(e) => setContent(e.target.value)}
      />
      {error && (
        <p className="form-error" role="alert">
          {error}
        </p>
      )}
      <div className="post-form-foot">
        <span className="muted num" style={{ fontSize: 'var(--fs-xs)' }}>
          {content.length.toLocaleString('ko-KR')} / 5,000자
        </span>
        <button type="submit" className="btn btn-primary btn-sm" disabled={busy}>
          {busy ? '올리는 중…' : '글 올리기'}
        </button>
      </div>
    </form>
  );
}

function Comments({ postId, onCount }) {
  const { user, requireLogin, handleAuthError, toast } = useSession();
  const [confirmUi, ask] = useConfirm();
  const list = useApi((signal) => boardApi.comments(postId, { signal }), [postId]);
  const [text, setText] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  const submit = async (e) => {
    e.preventDefault();
    if (!text.trim()) return;
    setBusy(true);
    setError('');
    try {
      await boardApi.writeComment(postId, text.trim());
      setText('');
      list.reload();
      onCount(1);
    } catch (err) {
      if (!handleAuthError(err)) setError(errorText(err, '댓글을 올리지 못했어요.'));
    } finally {
      setBusy(false);
    }
  };

  const remove = async (c) => {
    if (!(await ask({ title: '댓글을 지울까요?', desc: '지운 댓글은 되돌릴 수 없어요.' }))) return;
    try {
      await boardApi.removeComment(c.commentId);
      list.reload();
      onCount(-1);
      toast('댓글을 지웠어요.');
      // 지운 버튼이 사라져 초점이 맨 위로 튀던 것 (11/16 키보드 점검) → 댓글 입력칸으로
      document.getElementById(`cmt-${postId}`)?.focus();
    } catch (err) {
      if (!handleAuthError(err)) toast(errorText(err), 'error');
    }
  };

  const items = list.data?.items || [];
  return (
    <div className="comments">
      {list.loading && !list.data && <SkeletonRows rows={1} compact />}
      {list.error && <ErrorBox error={list.error} onRetry={list.reload} />}
      {list.data && items.length === 0 && <p className="muted" style={{ fontSize: 'var(--fs-sm)' }}>아직 댓글이 없어요.</p>}
      {items.map((c) => (
        <div key={c.commentId} className="comment">
          <div className="comment-meta">
            <b style={{ color: 'var(--text-2)' }}>{c.authorLoginId}</b>
            <span className="num">{relativeTime(c.createdAt)}</span>
            {user?.loginId === c.authorLoginId && (
              <button type="button" className="btn btn-sm btn-danger" onClick={() => remove(c)} aria-label={`${c.authorLoginId} 댓글 삭제`}>
                <Trash2 className="icon-sm" aria-hidden="true" />
                삭제
              </button>
            )}
          </div>
          <p className="comment-body">{c.content}</p>
        </div>
      ))}
      {user || text ? (
        <form className="comment-form" onSubmit={submit}>
          <label className="sr-only" htmlFor={`cmt-${postId}`}>
            댓글
          </label>
          <textarea
            id={`cmt-${postId}`}
            className="textarea"
            placeholder="댓글 달기"
            maxLength={1000}
            value={text}
            onChange={(e) => setText(e.target.value)}
          />
          <button type="submit" className="btn btn-secondary btn-sm" disabled={busy || !text.trim()} style={{ height: 40 }}>
            {busy ? '올리는 중…' : '등록'}
          </button>
        </form>
      ) : (
        <button type="button" className="btn btn-ghost btn-sm" style={{ marginTop: 6 }} onClick={() => requireLogin('댓글은 로그인하면 쓸 수 있어요.')}>
          로그인하고 댓글 달기
        </button>
      )}
      {error && (
        <p className="form-error" role="alert" style={{ marginTop: 8 }}>
          {error}
        </p>
      )}
      {confirmUi}
    </div>
  );
}

function Post({ post, onRemoved }) {
  const { user, requireLogin, handleAuthError, toast } = useSession();
  const [confirmUi, ask] = useConfirm();
  const [open, setOpen] = useState(false);
  const [like, setLike] = useState({ liked: false, count: post.likeCount });
  const [commentCount, setCommentCount] = useState(post.commentCount);
  const body = useApi((signal) => boardApi.post(post.postId, { signal }), [post.postId], { enabled: open });
  const mine = user?.loginId === post.authorLoginId;
  const detailId = `post-${post.postId}-detail`; // 펼침 버튼 두 개가 여는 곳 (낭독기가 버튼과 내용을 이어 읽음)

  const toggleLike = async () => {
    if (!user) {
      requireLogin('공감은 로그인하면 누를 수 있어요.');
      return;
    }
    try {
      const res = await boardApi.toggleLike(post.postId);
      setLike({ liked: res.liked, count: res.likeCount });
    } catch (err) {
      if (!handleAuthError(err)) toast(errorText(err), 'error');
    }
  };

  const remove = async () => {
    if (!(await ask({ title: '글을 지울까요?', desc: '댓글과 공감도 함께 지워지고 되돌릴 수 없어요.' }))) return;
    try {
      await boardApi.removePost(post.postId);
      toast('글을 지웠어요.');
      onRemoved();
    } catch (err) {
      if (!handleAuthError(err)) toast(errorText(err), 'error');
    }
  };

  return (
    <li className="post">
      <button type="button" className="post-title" aria-expanded={open} aria-controls={detailId} onClick={() => setOpen((o) => !o)}>
        {post.title}
      </button>
      <div className="post-meta">
        <span>{post.authorLoginId}</span>
        <span className="num">{relativeTime(post.createdAt)}</span>
      </div>
      <div id={detailId}>
        {open && (
          <div className="post-body">
            {body.loading && !body.data && <div className="skeleton sk-line" style={{ width: '60%' }} />}
            {body.error && <ErrorBox error={body.error} onRetry={body.reload} />}
            {body.data?.content}
          </div>
        )}
      </div>
      <div className="post-actions">
        <button type="button" className="btn btn-sm btn-ghost like-btn" aria-pressed={like.liked} onClick={toggleLike}>
          <Heart className="icon-sm" aria-hidden="true" />
          공감 <span className="num">{like.count}</span>
        </button>
        <button type="button" className="btn btn-sm btn-ghost" aria-expanded={open} aria-controls={detailId} onClick={() => setOpen((o) => !o)}>
          <MessageCircle className="icon-sm" aria-hidden="true" />
          댓글 <span className="num">{commentCount}</span>
        </button>
        {mine && (
          <button type="button" className="btn btn-sm btn-danger" onClick={remove} aria-label={`글 삭제: ${post.title}`}>
            <Trash2 className="icon-sm" aria-hidden="true" />
            삭제
          </button>
        )}
      </div>
      {open && <Comments postId={post.postId} onCount={(d) => setCommentCount((n) => Math.max(0, n + d))} />}
      {confirmUi}
    </li>
  );
}

export default function Board({ stockCode, stockName }) {
  const { user, requireLogin } = useSession();
  const [page, setPage] = useState(1);
  const [writing, setWriting] = useState(false);
  const posts = useApi((signal) => boardApi.posts(stockCode, { page, size: PAGE_SIZE }, { signal }), [stockCode, page]);
  const items = posts.data?.items || [];
  // 글을 올리면 폼이 사라져 포커스가 화면 맨 앞으로 튐 → 새 목록의 첫 글(방금 쓴 글) 제목으로 (11/13 사용자 눈으로)
  const listRef = useRef(null);
  const focusNew = useRef(false);
  useEffect(() => {
    if (!focusNew.current || !posts.data) return;
    focusNew.current = false;
    listRef.current?.querySelector('.post-title')?.focus();
  }, [posts.data]);

  return (
    <section className="card" aria-labelledby="board-title">
      <div className="card-head">
        <h2 className="card-title" id="board-title" tabIndex={-1}>
          종목 토론 {posts.data && <span className="count num">{posts.data.totalCount}</span>}
        </h2>
        <button
          type="button"
          className="btn btn-secondary btn-sm"
          aria-expanded={writing}
          onClick={() => (user ? setWriting((w) => !w) : requireLogin('토론 글은 로그인하면 쓸 수 있어요.', () => setWriting(true)))}
        >
          <PenLine className="icon-sm" aria-hidden="true" />
          {writing ? '쓰기 닫기' : '글쓰기'}
        </button>
      </div>
      {/* 로그인이 풀려도(401) 쓰던 글이 사라지지 않게 user 와 상관없이 둠 */}
      {writing && (
        <PostForm
          stockCode={stockCode}
          onDone={() => {
            focusNew.current = true;
            setWriting(false);
            if (page === 1) posts.reload();
            else setPage(1);
          }}
        />
      )}
      {posts.loading && !posts.data && <SkeletonRows rows={3} compact />}
      {posts.error && <ErrorBox error={posts.error} onRetry={posts.reload} />}
      {posts.data && items.length === 0 && (
        <Empty icon={MessageCircle} title={`${stockName} 토론 글이 아직 없어요`} desc="첫 글을 남겨 보세요." />
      )}
      {items.length > 0 && (
        <ul ref={listRef}>
          {items.map((p) => (
            <Post
              key={p.postId}
              post={p}
              onRemoved={() => {
                posts.reload();
                // 지운 글과 함께 초점도 사라져 맨 위로 튀던 것 (11/16 키보드 점검) → 토론 제목으로
                document.getElementById('board-title')?.focus();
              }}
            />
          ))}
        </ul>
      )}
      {posts.data && <Pager page={page} size={PAGE_SIZE} total={posts.data.totalCount} onChange={setPage} />}
    </section>
  );
}
