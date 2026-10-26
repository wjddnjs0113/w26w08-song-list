import { useLoaderData, useNavigate, Link  } from 'react-router'
import { supabase } from '../lib/supabase'
import { useAuthStore } from "~/lib/auth-store";
import type { Route } from "./+types/list";
import { useQuery, useQueryClient, useMutation  } from '@tanstack/react-query'
import { useState } from 'react'

export function meta({}: Route.MetaArgs) {
  return [
    { title: "애창곡" },
    { name: "description", content: "나의 애창곡 리스트" },
  ];
}

export async function clientLoader() {

  //-------------------------------------------------------
  // 세션 확인
  //-------------------------------------------------------
  if (useAuthStore.getState().status === "loading") {
    // 로그인 상태가 아직 로딩 중이면, 세션을 확인하고 상태를 업데이트
    const { data: { session } } = await supabase.auth.getSession()
    useAuthStore.getState().setSession(session)
  }

  // if (!useAuthStore.getState().session) {
  //   console.log("로그인 세션 없음")
  //   return { songs: [] }
  // }
}

// 로딩 화면. HydrateFallback 이름 정해져 있음
export function HydrateFallback() {
  return <div>로그인 세션 연결 중...</div>
}

// 오류 화면. ErrorBoundary 이름 정해져 있음
export function ErrorBoundary() {
  return <div>오류 발생</div>
}

export default function List() {
  // const { songs } = useLoaderData<typeof clientLoader>()
  const user = useAuthStore(s => s.user)
  // const githubSignIn = useAuthStore(s => s.githubSignIn)
  const queryClient = useQueryClient()
  const navigate = useNavigate()
  
  const [title, setTitle] = useState("")
  const [artist, setArtist] = useState("")
  const [rating, setRating] = useState(5)
  const [lyrics, setLyrics] = useState("")

  const { data: songs = [], isPending, isError, error } = useQuery({
    queryKey: ['songs'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('songs')
        .select('*')
      if (error) throw new Error(error.message)
      return data
    },
    enabled: !!user, // user가 있을 때만 쿼리 실행 (!!는 not의 not)

    // 5분 동안 신선한 상태 유지 (절대 서버에 다시 요청하지 않음)
    // staleTime이 줄어들다가 0이 되어도 자동으로 refetch되지는 않음
    // 다시 페이지를 방문했을 때 stale (시듬) 상태면 refetch됨
    staleTime: 1000 * 60 * 5, 
  })

    const addSongMutation = useMutation({
    mutationFn: async () => {
      const { data, error } = await supabase
        .from('songs')
        .insert([{ title, artist, rating, lyrics }])
      if (error) throw new Error(error.message)
      return data
    },
    onSuccess: () => {
      // 추가 성공 후, songs를 무효화하여 refetch되도록 함
      queryClient.invalidateQueries({ queryKey: ['songs'] })
      
      // 입력 필드 초기화
      setTitle("")
      setArtist("")
      setRating(5)
      setLyrics("")
    },
    onError: (err: any) => {
      alert(`노래 추가 실패: ${err.message}`)
    }
  })

    const deleteSongMutation = useMutation({
    mutationFn: async (songId: number) => {
      const { error } = await supabase
        .from('songs')
        .delete()
        .eq('id', songId)
      if (error) throw new Error(error.message)
    },
    onSuccess: () => {
      // 삭제 성공 후, songs를 무효화하여 refetch되도록 함
      queryClient.invalidateQueries({ queryKey: ['songs'] })
    },
    onError: (err: any) => {
      alert(`노래 삭제 실패: ${err.message}`)
    }
  })

  return (
    <div>
      <h2>애창곡 리스트 {user && `(${user.email})`}</h2>
      {user ? (
        isPending ? (
          <p>노래 데이터를 불러오는 중...</p>
        ) : isError ? (
          <p>에러 발생: {error.message}</p>
        ) : (
          <div>
            <button 
              onClick={ async () => {
                await useAuthStore.getState().signOut()
                // alert("로그아웃")
                queryClient.clear() 
                navigate('/')
              }}>
              로그아웃
            </button>

                        <form onSubmit={e => {
              e.preventDefault()
              addSongMutation.mutate()
            }}>
              <input
                type="text"
                value={title}
                placeholder="노래 제목 (*)"
                onChange={e => setTitle(e.target.value)}
                required/>
              <input
                type="text"
                value={artist}
                placeholder="가수 (*)"
                onChange={e => setArtist(e.target.value)}
                required/>
              <label>평점:</label>
              <input
                type="number"
                min="1"
                max="5"
                value={rating}
                onChange={e => setRating(parseInt(e.target.value))}
                required/>
              <textarea
                value={lyrics}
                placeholder="가사"
                onChange={e => setLyrics(e.target.value)}/>
              <button type="submit" disabled={addSongMutation.isPending}>
                노래 추가
              </button>
            </form>

            {songs.length === 0 ? (
              <p>등록된 노래가 없거나 데이터를 불러오지 못했습니다.</p>
            ) : (
              <ul>
                {songs.map((song: any) => (
                  <li key={song.id}>
                    <strong>{song.title}</strong> - {song.artist || '(가수 없음)'}
                    
                    <button
                      // 삭제 진행 중이면 버튼 비활성화
                      disabled={deleteSongMutation.isPending} 
                      onClick={() => {
                        if (confirm(`'${song.title}' 노래를 삭제하시겠습니까?`)) {
                          deleteSongMutation.mutate(song.id)
                        }
                      }}>
                      삭제
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>
        )
      ) : (
        <div>
          <Link to="/login">로그인</Link>
          <Link to="/signup">회원가입</Link>
          <button 
            onClick={async () => {
              try {
                // await githubSignIn() 
              } catch (err: any) {
                alert(`GitHub 인증 실패: ${err.message}`)
              }
            }}>
            GitHub 로그인
          </button>
        </div>
      )}     
    </div>
  )
}
